import * as XLSX from "xlsx"
import { createClient } from "@/lib/supabase/client"

export type OutputDocumentType = 
    | "bon_livraisons"
    | "bon_achats"
    | "bon_retours"
    | "bon_retour_achats"
    | "bon_commandes"
    | "devis"
    | "ventes_pos"

export interface ExportDocumentHeader {
    id: string;
    numero: string;
    date: string;
    statut: string;
    montant_ht: number;
    montant_ttc: number;
    inclure_tva: boolean;
    client?: { raison_sociale: string };
    fournisseur?: { raison_sociale: string };
    mode_paiement?: string;
}

export async function exportDocumentsToExcelDetailed(
    table: OutputDocumentType,
    fileName: string,
    filteredHeaders: ExportDocumentHeader[]
) {
    if (!filteredHeaders || filteredHeaders.length === 0) {
        throw new Error("Aucune donnée à exporter")
    }

    const supabase = createClient()
    const docIds = filteredHeaders.map(d => d.id)
    
    // We fetch lines based on table type!
    let linesQuery = ""
    let lineTableName = ""

    switch (table) {
        case "bon_livraisons": lineTableName = "bon_livraison_lignes"; break;
        case "bon_achats": lineTableName = "bon_achat_lignes"; break;
        case "bon_retours": lineTableName = "bon_retour_lignes"; break;
        case "bon_retour_achats": lineTableName = "bon_retour_achat_lignes"; break;
        case "bon_commandes": lineTableName = "bon_commande_lignes"; break;
        case "devis": lineTableName = "devis_lignes"; break;
        case "ventes_pos": lineTableName = "vente_pos_lignes"; break;
    }

    // Convert table suffix (bon_livraisons -> bon_livraison_id) for foreign key matching
    const fkey = table === "ventes_pos" ? "vente_pos_id" : table.replace(/s$/, "") + "_id"

    // Fetch lines with articles
    const { data: lignesData, error } = await supabase
        .from(lineTableName)
        .select(`*, article:articles(code, reference, designation)`)
        .in(fkey, docIds)

    if (error) {
        console.error("Error fetching lines:", error)
        throw new Error("Erreur lors de la récupération des détails")
    }

    // Build flattened Excel data
    let excelRows: any[] = []

    for (const header of filteredHeaders) {
        const docLines = (lignesData as any[])?.filter(l => l[fkey] === header.id) || []
        
        const tiers = header.client?.raison_sociale || header.fournisseur?.raison_sociale || "—"

        if (docLines.length === 0) {
            // Document without lines
            excelRows.push({
                "N° Document": header.numero,
                "Date": new Date(header.date).toLocaleDateString("fr-FR"),
                "Tiers": tiers,
                "Statut": header.statut,
                "Code Article": "—",
                "Désignation": "—",
                "Quantité": 0,
                "Prix Unitaire": 0,
                "TVA (%)": 0,
                "Total Ligne HT": 0,
                "Total Doc HT": header.montant_ht,
                "Total Doc TTC": header.montant_ttc,
                "TVA Facturée": header.inclure_tva ? "Oui" : "Non"
            })
        } else {
            // Rows for each line
            for (const [index, ligne] of docLines.entries()) {
                excelRows.push({
                    "N° Document": index === 0 ? header.numero : "", // Only show doc header once per block if preferred, or on every line. Let's show on every line for good Excel pivoting.
                    "Date": new Date(header.date).toLocaleDateString("fr-FR"),
                    "Tiers": tiers,
                    "Statut": header.statut,
                    "Code Article": ligne.article?.code || "—",
                    "Désignation": ligne.article?.designation || ligne.designation || "—",
                    "Quantité": ligne.quantite,
                    "Prix Unitaire": ligne.prix_unitaire,
                    "TVA (%)": ligne.tva,
                    "Total Ligne HT": ligne.montant_ht,
                    "Total Doc HT": index === 0 ? header.montant_ht : "", // Only show totals once per document block to avoid SUM duplication
                    "Total Doc TTC": index === 0 ? header.montant_ttc : "",
                    "TVA Facturée": header.inclure_tva ? "Oui" : "Non"
                })
            }
        }
    }

    // To improve Pivot Table usage, let's actually fill the blank rows for "N° Document"
    // so let's overwrite the excelRows strategy to fill EVERY column
    excelRows = excelRows.map(row => ({
        ...row,
        "Total Doc HT": row["Total Doc HT"] !== "" ? row["Total Doc HT"] : 0, 
        // Wait, filling Totals everywhere ruins basic sums, but users in excel usually just sum the lines, OR filter by unique doc.
        // Let's just restore "N° Document" mapping.
    }))

    // Let's fix the explicit fill for pivots
    const fullPivotRows = []
    for (const header of filteredHeaders) {
        const docLines = (lignesData as any[])?.filter(l => l[fkey] === header.id) || []
        const tiers = header.client?.raison_sociale || header.fournisseur?.raison_sociale || "—"

        if (docLines.length === 0) {
            fullPivotRows.push({
                "N° Document": header.numero,
                "Date": new Date(header.date).toLocaleDateString("fr-FR"),
                "Tiers": tiers,
                "Statut": header.statut,
                "Code Article": "—",
                "Désignation": "—",
                "Quantité": 0,
                "Prix Unitaire HT": 0,
                "Total Ligne HT": 0,
                "Document Total HT": header.montant_ht,
                "Document Total TTC": header.montant_ttc,
                "Mode TVA": header.inclure_tva ? "Fiscal" : "Normal"
            })
        } else {
            for (const ligne of docLines) {
                fullPivotRows.push({
                    "N° Document": header.numero,
                    "Date": new Date(header.date).toLocaleDateString("fr-FR"),
                    "Tiers": tiers,
                    "Statut": header.statut,
                    "Code Article": ligne.article?.code || "—",
                    "Désignation": ligne.article?.designation || ligne.designation || "—",
                    "Quantité": ligne.quantite,
                    "Prix Unitaire HT": ligne.prix_unitaire,
                    "Total Ligne HT": ligne.montant_ht,
                    "Document Total HT": header.montant_ht,
                    "Document Total TTC": header.montant_ttc,
                    "Mode TVA": header.inclure_tva ? "Fiscal" : "Normal"
                })
            }
        }
    }

    // WorkBook Creation
    const worksheet = XLSX.utils.json_to_sheet(fullPivotRows)

    // Adjust column widths
    const maxWidths = fullPivotRows.reduce((acc, row) => {
        Object.keys(row).forEach(key => {
            const width = Math.max(
                acc[key] || 10, // Minimum width
                key.length, // Header width
                row[key as keyof typeof row] ? String(row[key as keyof typeof row]).length : 0 // Value width
            )
            acc[key] = width + 2 // Base padding
        })
        return acc
    }, {} as Record<string, number>)

    worksheet['!cols'] = Object.keys(fullPivotRows[0] || {}).map(key => ({
        wch: Math.min(maxWidths[key] || 15, 40) // Cap max width to 40
    }))

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Détails")

    // Trigger download
    XLSX.writeFile(workbook, `${fileName}.xlsx`)
}
