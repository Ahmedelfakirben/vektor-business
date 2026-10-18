"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

export type Operation = {
    id: string
    date: string
    numero?: string
    type: "Vente" | "Achat" | "Retour Client" | "Retour Fournisseur" | "Vente POS" | "Paiement"
    tiers: string
    montant: number
    utilisateur: string
    statut?: string
    reference_id: string
    reference_type: string
    mode_paiement?: string
    montant_regle?: number
}

export function useOperations(startDate: string, endDate: string, fiscalMode: boolean = false) {
    const supabase = createClient()

    return useQuery({
        queryKey: ["operations", startDate, endDate, fiscalMode],
        queryFn: async () => {
            let qBl = supabase.from("bon_livraisons").select("id, date, numero, montant_ttc, montant_regle, statut_paiement, client:clients(raison_sociale)").gte("date", startDate).lte("date", endDate)
            let qBa = supabase.from("bon_achats").select("id, date, numero, montant_ttc, montant_regle, statut_paiement, fournisseur:fournisseurs(raison_sociale)").gte("date", startDate).lte("date", endDate)
            let qBr = supabase.from("bon_retours").select("id, date, numero, montant_ttc, montant_regle, statut_paiement, client:clients(raison_sociale)").gte("date", startDate).lte("date", endDate)
            let qBra = supabase.from("bon_retour_achats").select("id, date, numero, montant_ttc, montant_regle, statut_paiement, fournisseur:fournisseurs(raison_sociale)").gte("date", startDate).lte("date", endDate)
            let qPos = supabase.from("ventes_pos").select("id, date, numero, montant_ttc, mode_paiement, client:clients(raison_sociale), commercial:profiles!ventes_pos_commercial_id_fkey(nom, prenom)").gte("date", startDate).lte("date", endDate)
            let qPaiements = supabase.from("paiements").select("id, date, montant, mode_paiement, reference_type, reference_id").gte("date", startDate).lte("date", endDate)

            if (fiscalMode) {
                qBl = qBl.eq("inclure_tva", true)
                qBa = qBa.eq("inclure_tva", true)
                qBr = qBr.eq("inclure_tva", true)
                qBra = qBra.eq("inclure_tva", true)
                qPos = qPos.eq("inclure_tva", true)
                // Note: Paiements are filtered out later in JS to only include payments for fiscal docs.
            }

            const [
                { data: bl },
                { data: ba },
                { data: br },
                { data: bra },
                { data: pos },
                { data: paiementsRaw }
            ] = await Promise.all([qBl, qBa, qBr, qBra, qPos, qPaiements])

            // If in fiscal mode, filter payments to only those referencing the fetched fiscal documents
            let finalPaiements: any[] = (paiementsRaw as any[]) || []
            if (fiscalMode) {
                const validDocIds = new Set([
                    ...(bl || []).map(d => (d as any).id),
                    ...(ba || []).map(d => (d as any).id),
                    ...(br || []).map(d => (d as any).id),
                    ...(bra || []).map(d => (d as any).id),
                    ...(pos || []).map(d => (d as any).id)
                ])
                finalPaiements = finalPaiements.filter(p => p.reference_type === 'depense' || validDocIds.has(p.reference_id))
            }

            const operations: Operation[] = [
                ...((bl as any[]) || []).map(d => ({
                    id: d.id,
                    date: d.date,
                    numero: d.numero,
                    type: "Vente" as const,
                    tiers: d.client ? (d.client as any).raison_sociale : "Client Inconnu",
                    montant: d.montant_ttc,
                    montant_regle: d.montant_regle || 0,
                    statut: d.statut_paiement || "impaye",
                    utilisateur: d.commercial ? `${(d.commercial as any).nom} ${(d.commercial as any).prenom}` : "Système",
                    reference_id: d.id,
                    reference_type: "bon_livraison"
                })),
                ...((ba as any[]) || []).map(d => ({
                    id: d.id,
                    date: d.date,
                    numero: d.numero,
                    type: "Achat" as const,
                    tiers: d.fournisseur ? (d.fournisseur as any).raison_sociale : "Fournisseur Inconnu",
                    montant: -d.montant_ttc,
                    montant_regle: d.montant_regle || 0,
                    statut: d.statut_paiement || "impaye",
                    utilisateur: "Admin",
                    reference_id: d.id,
                    reference_type: "bon_achat"
                })),
                ...((br as any[]) || []).map(d => ({
                    id: d.id,
                    date: d.date,
                    numero: d.numero,
                    type: "Retour Client" as const,
                    tiers: d.client ? (d.client as any).raison_sociale : "Client Inconnu",
                    montant: -d.montant_ttc,
                    montant_regle: d.montant_regle || 0,
                    statut: d.statut_paiement || "impaye",
                    utilisateur: "Admin",
                    reference_id: d.id,
                    reference_type: "bon_retour"
                })),
                ...((bra as any[]) || []).map(d => ({
                    id: d.id,
                    date: d.date,
                    numero: d.numero,
                    type: "Retour Fournisseur" as const,
                    tiers: d.fournisseur ? (d.fournisseur as any).raison_sociale : "Fournisseur Inconnu",
                    montant: d.montant_ttc,
                    montant_regle: d.montant_regle || 0,
                    statut: d.statut_paiement || "impaye",
                    utilisateur: "Admin",
                    reference_id: d.id,
                    reference_type: "bon_retour_achat"
                })),
                ...((pos as any[]) || []).map(d => ({
                    id: d.id,
                    date: d.date,
                    numero: d.numero,
                    type: "Vente POS" as const,
                    tiers: d.client ? (d.client as any).raison_sociale : "Comptoir",
                    montant: d.montant_ttc,
                    montant_regle: d.montant_ttc, // POS always paid
                    statut: "paye",
                    utilisateur: d.commercial ? `${(d.commercial as any).nom} ${(d.commercial as any).prenom}` : "Vendeur",
                    reference_id: d.id,
                    reference_type: "vente_pos",
                    mode_paiement: d.mode_paiement
                })),
                ...(finalPaiements.map(d => {
                    const isSortie = ["bon_achat", "bon_retour", "depense"].includes(d.reference_type);
                    return {
                        id: d.id,
                        date: d.date,
                        numero: d.mode_paiement.toUpperCase(),
                        type: "Paiement" as const,
                        tiers: `Réf: ${d.reference_type}`,
                        montant: isSortie ? -d.montant : d.montant,
                        montant_regle: d.montant,
                        statut: "encaisse",
                        utilisateur: "Admin",
                        reference_id: d.reference_id,
                        reference_type: d.reference_type,
                        mode_paiement: d.mode_paiement
                    };
                }))
            ]

            return operations.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        },
        enabled: !!startDate && !!endDate,
    })
}
