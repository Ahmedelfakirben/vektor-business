"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { MouvementStock } from "@/types/database"

export function useMouvementStockList() {
    const supabase = createClient()
    return useQuery({
        queryKey: ["mouvements-stock"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("mouvements_stock")
                .select("*, article:articles(*), depot:depots(*)")
                .order("created_at", { ascending: false })
                .limit(200)
            if (error) throw error
            return data as MouvementStock[]
        },
    })
}

export type HistoriqueArticleRow = MouvementStock & {
    document_numero?: string;
    document_tiers?: string;
    document_statut?: string;
}

export function useHistoriqueArticle(articleId: string) {
    const supabase = createClient()
    return useQuery({
        queryKey: ["historique-article", articleId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("mouvements_stock")
                .select("*, depot:depots(*)")
                .eq("article_id", articleId)
                .order("created_at", { ascending: false })
            if (error) throw error

            const mvtData = data as HistoriqueArticleRow[]
            if (!mvtData.length) return mvtData

            // Fetch extra info using batch queries
            const blIds = mvtData.filter(m => m.reference_type === "bon_livraison").map(m => m.reference_id)
            const baIds = mvtData.filter(m => m.reference_type === "bon_achat").map(m => m.reference_id)
            const brIds = mvtData.filter(m => m.reference_type === "bon_retour").map(m => m.reference_id)
            const braIds = mvtData.filter(m => m.reference_type === "bon_retour_achat").map(m => m.reference_id)
            const posIds = mvtData.filter(m => m.reference_type === "vente_pos").map(m => m.reference_id)
            const regIds = mvtData.filter(m => m.reference_type === "regularisation").map(m => m.reference_id)

            const promises = []
            if (blIds.length) promises.push(supabase.from("bon_livraisons").select("id, numero, statut_paiement, client:clients(raison_sociale)").in("id", blIds).then(res => ({ type: 'bon_livraison', data: res.data })))
            if (baIds.length) promises.push(supabase.from("bon_achats").select("id, numero, statut_paiement, fournisseur:fournisseurs(raison_sociale)").in("id", baIds).then(res => ({ type: 'bon_achat', data: res.data })))
            if (brIds.length) promises.push(supabase.from("bon_retours").select("id, numero, statut_paiement, client:clients(raison_sociale)").in("id", brIds).then(res => ({ type: 'bon_retour', data: res.data })))
            if (braIds.length) promises.push(supabase.from("bon_retour_achats").select("id, numero, statut_paiement, fournisseur:fournisseurs(raison_sociale)").in("id", braIds).then(res => ({ type: 'bon_retour_achat', data: res.data })))
            if (posIds.length) promises.push(supabase.from("ventes_pos").select("id, numero, client:clients(raison_sociale)").in("id", posIds).then(res => ({ type: 'vente_pos', data: res.data })))

            const results = await Promise.all(promises)
            const docMap = new Map<string, any>()
            
            results.forEach(res => {
                if(res.data) {
                    res.data.forEach((doc: any) => {
                        docMap.set(doc.id, {
                            ...doc,
                            _type: res.type
                        })
                    })
                }
            })

            // Merge
            for (const m of mvtData) {
                const doc = docMap.get(m.reference_id)
                if (doc) {
                    m.document_numero = doc.numero
                    m.document_tiers = doc.client ? doc.client.raison_sociale : (doc.fournisseur ? doc.fournisseur.raison_sociale : "—")
                    m.document_statut = doc.statut_paiement || (doc._type === "vente_pos" ? "paye" : "—")
                }
            }

            return mvtData
        },
        enabled: !!articleId,
    })
}
