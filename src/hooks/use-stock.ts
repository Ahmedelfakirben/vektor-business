"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { Stock } from "@/types/database"
import { useFiscalMode } from "@/providers/fiscal-mode-context"

export function useStockList() {
    const supabase = createClient()
    const { fiscalMode } = useFiscalMode()

    return useQuery({
        queryKey: ["stock", fiscalMode],
        queryFn: async () => {
            if (fiscalMode) {
                const { data, error } = await (supabase.rpc as any)("get_fiscal_stock")
                if (error) throw error
                
                // Map flat RPC result to match the structured Stock type
                return (data as any[]).map(row => ({
                    id: row.id,
                    article_id: row.article_id,
                    depot_id: row.depot_id,
                    quantite: row.quantite,
                    article: {
                        id: row.article_id,
                        code: row.article_code,
                        designation: row.article_designation,
                        prix_achat: row.article_prix_achat,
                        prix_vente: row.article_prix_vente,
                        tva: row.article_tva,
                        famille: { libelle: row.famille_libelle },
                        sous_famille: { libelle: row.sous_famille_libelle }
                    },
                    depot: {
                        id: row.depot_id,
                        libelle: row.depot_libelle
                    }
                })) as Stock[]
            }

            const { data, error } = await supabase
                .from("stock")
                .select("*, article:articles(*, famille:familles_articles(*), sous_famille:sous_familles_articles(*)), depot:depots(*)")
                .order("quantite", { ascending: true })
            if (error) throw error
            return data as Stock[]
        },
    })
}

export function useAdjustStock() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            articleId,
            depotId,
            quantity,
            type,
            notes
        }: {
            articleId: string
            depotId: string
            quantity: number
            type: "entree" | "sortie"
            notes?: string
        }) => {
            const { error } = await (supabase.rpc as any)("update_stock", {
                p_article_id: articleId,
                p_depot_id: depotId,
                p_quantite: quantity,
                p_type: type,
                p_ref_type: "ajustement_manuel",
                p_ref_id: articleId
            })

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["stock"] })
            queryClient.invalidateQueries({ queryKey: ["articles"] })
        },
    })
}

export function useStockByDepot(depot_id: string) {
    const supabase = createClient()
    const { fiscalMode } = useFiscalMode()

    return useQuery({
        queryKey: ["stock", "depot", depot_id, fiscalMode],
        queryFn: async () => {
            if (fiscalMode) {
                const { data, error } = await (supabase.rpc as any)("get_fiscal_stock", { p_depot_id: depot_id })
                    .select("*, article:articles(*, famille:familles_articles(*)), depot:depots(*)")
                
                if (error) throw error
                return data as Stock[]
            }

            const { data, error } = await supabase
                .from("stock")
                .select("*, article:articles(*, famille:familles_articles(*)), depot:depots(*)")
                .eq("depot_id", depot_id)
                .order("quantite", { ascending: true })
            if (error) throw error
            return data as Stock[]
        },
        enabled: !!depot_id,
    })
}

export function useAjusterStock() {
    const supabase = createClient()
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ article_id, depot_id, quantite }: { article_id: string; depot_id: string; quantite: number }) => {
            // Upsert stock
            const { data: existing } = await supabase
                .from("stock")
                .select("id, quantite")
                .eq("article_id", article_id)
                .eq("depot_id", depot_id)
                .maybeSingle()

            if (existing) {
                const { error } = await (supabase.from("stock") as any).update({ quantite }).eq("id", (existing as any).id)
                if (error) throw error
            } else {
                const { error } = await (supabase.from("stock") as any).insert({ article_id, depot_id, quantite })
                if (error) throw error
            }
        },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["stock"] }) },
    })
}
