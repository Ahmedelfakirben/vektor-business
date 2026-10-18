"use client"

import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"
import { generateDocumentPDF } from "@/lib/pdf-generator"

interface PrintDocumentButtonProps {
    type: "devis" | "bon_livraison" | "bon_retour" | "bon_commande" | "bon_achat" | "bon_retour_achat"
    document: {
        numero: string
        date: string
        montant_ht: number
        montant_tva: number
        montant_ttc: number
        notes?: string | null
        client?: { raison_sociale: string; code: string; adresse?: string | null; telephone?: string | null; ice?: string | null } | null
        fournisseur?: { raison_sociale: string; code: string; adresse?: string | null; telephone?: string | null; ice?: string | null } | null
        lignes?: Array<{ designation: string; quantite: number; prix_unitaire: number; tva: number; montant_ht: number }> | null
        validite_jours?: number
        motif?: string | null
        inclure_tva?: boolean
    }
}

export function PrintDocumentButton({ type, document: doc }: PrintDocumentButtonProps) {
    const isFournisseur = type === "bon_commande" || type === "bon_achat" || type === "bon_retour_achat"
    const tiers = isFournisseur ? doc.fournisseur : doc.client

    const handlePrint = () => {
        if (!tiers) return

        const company = typeof window !== "undefined" ? (() => {
            try { return JSON.parse(localStorage.getItem("company_info") || "{}") } catch { return {} }
        })() : {}

        const extra: Record<string, string> = {}
        if (doc.validite_jours) extra["Validité"] = `${doc.validite_jours} jours`
        if (doc.motif) extra["Motif"] = doc.motif

        generateDocumentPDF(
            {
                type,
                numero: doc.numero,
                date: doc.date,
                tiers: { raison_sociale: tiers.raison_sociale, code: tiers.code, adresse: tiers.adresse, telephone: tiers.telephone, ice: tiers.ice },
                lignes: doc.lignes || [],
                montant_ht: doc.montant_ht,
                montant_tva: doc.montant_tva,
                montant_ttc: doc.montant_ttc,
                inclure_tva: doc.inclure_tva,
                notes: doc.notes,
                extra: Object.keys(extra).length > 0 ? extra : undefined,
            },
            company.nom ? company : undefined
        )
    }

    return (
        <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />Imprimer
        </Button>
    )
}
