"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { Article } from "@/types/database"
import type { ArticleFormData } from "@/lib/validations/master-data"

export function useArticles() {
    const supabase = createClient()

    return useQuery({
        queryKey: ["articles"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("articles")
                .select("*, famille:familles_articles(*), sous_famille:sous_familles_articles(*), stock(*)")
                .order("designation")
            if (error) throw error

            // Calculate total stock client-side to avoid view dependency issues
            return (data as any[]).map(article => ({
                ...article,
                stock_actuel: article.stock?.reduce((sum: number, s: any) => sum + s.quantite, 0) || 0
            })) as Article[]
        },
    })
}

export function useArticle(id: string) {
    const supabase = createClient()

    return useQuery({
        queryKey: ["articles", id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("articles")
                .select("*, famille:familles_articles(*), stock(*)")
                .eq("id", id)
                .single()
            if (error) throw error

            const article = data as any
            const stock_actuel = article.stock?.reduce((sum: number, s: any) => sum + s.quantite, 0) || 0

            return { ...article, stock_actuel } as Article
        },
        enabled: !!id,
    })
}

export function useCreateArticle() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (formData: ArticleFormData) => {
            // Séparer les données de l'article et du stock
            const { stock_initial, depot_id, ...articleData } = formData

            // Robust code generation like BL/BA
            let code = articleData.code
            if (!code || code === "" || code === "Génération auto...") {
                const { data: nextCode } = await (supabase.rpc as any)("next_numero", { p_type: "article" })
                code = nextCode
            }

            // 1. Créer l'article
            const { data: article, error: articleError } = await supabase
                .from("articles")
                .insert({ ...articleData, code } as any)
                .select()
                .single()

            if (articleError) throw articleError

            const createdArticle = article as Article // Cast to ensure type safety

            // Auto-index visual signature if image_url is present
            if (articleData.image_url) {
                fetch("/api/articles/signature", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ image: articleData.image_url, article_id: (article as any).id }),
                }).catch(() => {})
            }

            // 2. Si stock initial, ajouter mouvement via RPC pour mise à jour cohérente
            if (stock_initial && stock_initial > 0 && depot_id) {
                const { error: stockError } = await (supabase.rpc as any)("update_stock", {
                p_article_id: (article as any).id,
                p_depot_id: formData.depot_id,
                p_quantite: formData.stock_initial,
                p_type: "entree",
                p_ref_type: "stock_initial",
                p_ref_id: (article as any).id
            })

                if (stockError) {
                    console.error("Error creating initial stock:", stockError)
                }
            }

            return article
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["articles"] })
            queryClient.invalidateQueries({ queryKey: ["stock"] }) // If stock hook exists
        },
    })
}

export function useUpdateArticle() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: ArticleFormData }) => {
            // Separar datos de stock
            const { stock_initial, depot_id, ...articleData } = data

            // 1. Mise à jour Article
            const { data: result, error } = await (supabase
                .from("articles") as any)
                .update(articleData)
                .eq("id", id)
                .select()
                .single()
            if (error) throw error

            // Auto-index visual signature if image_url is present
            if (articleData.image_url) {
                fetch("/api/articles/signature", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ image: articleData.image_url, article_id: id }),
                }).catch(() => {})
            }

            // 2. Si ajustement stock demandé
            if (stock_initial && stock_initial > 0 && depot_id) {
                const { error: stockError } = await (supabase.rpc as any)("update_stock", {
                p_article_id: id,
                p_depot_id: data.depot_id,
                p_quantite: stock_initial,
                p_type: "entree",
                p_ref_type: "ajustement_manuel",
                p_ref_id: id
            })

                if (stockError) console.error("Stock update error:", stockError)
            }

            return result
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["articles"] })
            queryClient.invalidateQueries({ queryKey: ["stock"] })
        },
    })
}

export function useDeleteArticle() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("articles").delete().eq("id", id)
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["articles"] })
        },
    })
}

export function useArticlePurchaseHistory(id: string) {
    const supabase = createClient()

    return useQuery({
        queryKey: ["articles", id, "purchase-history"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("v_historial_compras_articulos")
                .select("*")
                .eq("article_id", id)
            if (error) throw error
            return data
        },
        enabled: !!id,
    })
}
