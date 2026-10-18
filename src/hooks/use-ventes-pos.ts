"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { VentePos } from "@/types/database"
import type { VentePosFormData } from "@/lib/validations/operations"

export function useVentePosList() {
    const supabase = createClient()
    return useQuery({
        queryKey: ["ventes-pos"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("ventes_pos")
                .select("*, client:clients(*), commercial:profiles(*), tresorerie:tresoreries(*), depot:depots(*), lignes:vente_pos_lignes(*)")
                .order("created_at", { ascending: false })
            if (error) throw error
            return data as VentePos[]
        },
    })
}

export function useVentePos(id: string) {
    const supabase = createClient()
    return useQuery({
        queryKey: ["ventes-pos", id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("ventes_pos")
                .select("*, client:clients(*), commercial:profiles(*), tresorerie:tresoreries(*), depot:depots(*), lignes:vente_pos_lignes(*, article:articles(*))")
                .eq("id", id)
                .single()
            if (error) throw error
            return data as VentePos
        },
        enabled: !!id,
    })
}

export function useCreateVentePos() {
    const supabase = createClient()
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ formData, commercial_id }: { formData: VentePosFormData; commercial_id: string }) => {
            const lignes = formData.lignes
            const calculatedHT = lignes.reduce((s, l) => s + (l.montant_ht !== undefined ? Number(l.montant_ht) : l.quantite * l.prix_unitaire), 0)
            const montant_ht = formData.montant_ht !== undefined ? Number(formData.montant_ht) : calculatedHT
            const montant_tva = formData.inclure_tva ? lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire * (l.tva / 100), 0) : 0
            const montant_ttc = formData.montant_ttc !== undefined ? Number(formData.montant_ttc) : (montant_ht + montant_tva)

            // Resolve commercial_id if empty or missing
            let finalCommercialId = commercial_id
            if (!finalCommercialId || finalCommercialId.trim() === "") {
                const { data: { user } } = await supabase.auth.getUser()
                if (user?.id) {
                    const { data: userProfile } = await (supabase
                        .from("profiles") as any)
                        .select("id")
                        .eq("user_id", user.id)
                        .maybeSingle()
                    finalCommercialId = (userProfile as any)?.id
                }
                if (!finalCommercialId) {
                    const { data: defaultProfile } = await (supabase
                        .from("profiles") as any)
                        .select("id")
                        .limit(1)
                        .maybeSingle()
                    finalCommercialId = (defaultProfile as any)?.id
                }
            }

            let vente = null
            let lastError = null

            for (let attempt = 0; attempt < 3; attempt++) {
                let numero = null
                try {
                    const { data: nextNum } = await (supabase.rpc as any)("next_numero", { p_type: "vente_pos" })
                    numero = nextNum
                } catch (rpcErr) {
                    console.warn("RPC next_numero error:", rpcErr)
                }

                // If rpc didn't return a number or on retry
                if (!numero || attempt > 0) {
                    numero = `POS-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`
                }

                const { data: insertedVente, error } = await (supabase
                    .from("ventes_pos") as any)
                    .insert({
                        numero,
                        date: new Date().toISOString().split("T")[0],
                        client_id: formData.client_id || null,
                        commercial_id: finalCommercialId, 
                        tresorerie_id: formData.tresorerie_id,
                        depot_id: formData.depot_id,
                        montant_ht, 
                        montant_tva, 
                        montant_ttc,
                        remise: formData.remise || 0,
                        mode_paiement: formData.mode_paiement,
                        inclure_tva: Boolean(formData.inclure_tva),
                    })
                    .select()
                    .single()

                if (!error && insertedVente) {
                    vente = insertedVente
                    break
                }

                lastError = error
                if (error?.code === "23505" || error?.message?.includes("ventes_pos_numero_key")) {
                    console.warn(`Numero collision on ${numero}, retrying attempt ${attempt + 1}...`)
                    continue
                } else {
                    break
                }
            }

            if (!vente) {
                console.error("ventes_pos insert error:", lastError)
                throw new Error(lastError?.message || "Erreur lors de l'enregistrement de la vente")
            }

            const lignesData = lignes.map((l) => ({
                vente_pos_id: (vente as any).id, 
                article_id: l.article_id,
                designation: l.designation, 
                quantite: Number(l.quantite), 
                prix_unitaire: Number(l.prix_unitaire),
                tva: formData.inclure_tva ? Number(l.tva || 0) : 0, 
                montant_ht: l.montant_ht !== undefined ? Number(l.montant_ht) : Number(l.quantite) * Number(l.prix_unitaire),
            }))
            const { error: le } = await (supabase
                .from("vente_pos_lignes") as any)
                .insert(lignesData)
            if (le) {
                console.error("vente_pos_lignes insert error:", le)
                throw new Error(le.message || "Erreur lors de l'enregistrement des lignes")
            }

            // Register payment for this POS sale so it credits treasury and generates movements_tresorerie
            try {
                const { error: pe } = await (supabase.from("paiements") as any).insert({
                    date: (vente as any).date || new Date().toISOString().split("T")[0],
                    montant: Number(montant_ttc),
                    mode_paiement: formData.mode_paiement,
                    tresorerie_id: formData.tresorerie_id,
                    reference_type: "vente_pos",
                    reference_id: (vente as any).id,
                    note: `Encaissement Vente POS N° ${(vente as any).numero}`,
                    statut_versement: "encaisse"
                })
                if (pe) {
                    console.error("paiements insert error for POS:", pe)
                }
            } catch (pErr) {
                console.error("Failed to insert POS payment:", pErr)
            }

            return vente
        },
        onSuccess: () => { 
            queryClient.invalidateQueries({ queryKey: ["ventes-pos"] }) 
            queryClient.invalidateQueries({ queryKey: ["articles-active-pos"] })
            queryClient.invalidateQueries({ queryKey: ["stock"] })
            queryClient.invalidateQueries({ queryKey: ["tresoreries"] })
            queryClient.invalidateQueries({ queryKey: ["mouvements_tresorerie"] })
            queryClient.invalidateQueries({ queryKey: ["operations"] })
        },
    })
}

export function useDeleteVentePos() {
    const supabase = createClient()
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (id: string) => {
            // 1. Fetch lines and depot to restore stock
            const { data: v } = await supabase
                .from("ventes_pos")
                .select("depot_id, lignes:vente_pos_lignes(article_id, quantite)")
                .eq("id", id)
                .single()

            if (v && (v as any).lignes) {
                for (const l of (v as any).lignes as any[]) {
                    try {
                        await (supabase.rpc as any)("update_stock", {
                            p_article_id: l.article_id,
                            p_depot_id: (v as any).depot_id,
                            p_quantite: Number(l.quantite),
                            p_type: "entree",
                            p_reference_type: "annulation_pos",
                            p_reference_id: id,
                            p_inclure_tva: false
                        })
                    } catch (stkErr) {
                        console.warn("Stock restore on delete error:", stkErr)
                    }
                }
            }

            // 2. Delete payment records (reverses treasury movement and updates solde)
            await supabase.from("paiements").delete().eq("reference_type", "vente_pos").eq("reference_id", id)

            // 3. Delete sale
            const { error } = await supabase.from("ventes_pos").delete().eq("id", id)
            if (error) throw error
        },
        onSuccess: () => { 
            queryClient.invalidateQueries({ queryKey: ["ventes-pos"] })
            queryClient.invalidateQueries({ queryKey: ["articles-active-pos"] })
            queryClient.invalidateQueries({ queryKey: ["stock"] })
            queryClient.invalidateQueries({ queryKey: ["tresoreries"] })
            queryClient.invalidateQueries({ queryKey: ["mouvements_tresorerie"] })
            queryClient.invalidateQueries({ queryKey: ["operations"] })
        },
    })
}

export interface SoldArticleSummary {
    article_id: string
    code: string
    designation: string
    code_barre?: string | null
    image_url?: string | null
    prix_vente: number
    quantite_vendue: number
    ventes_recents: {
        vente_id: string
        numero: string
        date: string
        quantite: number
        prix_unitaire: number
    }[]
}

export function useSoldArticlesPos() {
    const supabase = createClient()
    return useQuery({
        queryKey: ["pos-sold-articles"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("vente_pos_lignes")
                .select("article_id, designation, quantite, prix_unitaire, vente:ventes_pos(id, numero, date), article:articles(id, code, designation, code_barre, image_url, prix_vente)")
                .order("id", { ascending: false })
            if (error) throw error

            const map = new Map<string, SoldArticleSummary>()
            for (const row of (data as any[])) {
                if (!row.article_id || !row.article) continue
                const artId = row.article_id
                if (!map.has(artId)) {
                    map.set(artId, {
                        article_id: artId,
                        code: row.article.code,
                        designation: row.article.designation,
                        code_barre: row.article.code_barre,
                        image_url: row.article.image_url,
                        prix_vente: Number(row.article.prix_vente),
                        quantite_vendue: 0,
                        ventes_recents: [],
                    })
                }
                const entry = map.get(artId)!
                entry.quantite_vendue += Number(row.quantite || 0)
                if (row.vente) {
                    entry.ventes_recents.push({
                        vente_id: row.vente.id,
                        numero: row.vente.numero,
                        date: row.vente.date,
                        quantite: Number(row.quantite),
                        prix_unitaire: Number(row.prix_unitaire),
                    })
                }
            }
            return Array.from(map.values())
        },
    })
}

export interface CreateRetourPosData {
    vente_pos_id?: string | null
    client_id?: string | null
    commercial_id?: string
    depot_id: string
    tresorerie_id: string
    montant_total: number
    mode_remboursement: string
    motif?: string
    lignes: {
        article_id: string
        designation: string
        quantite: number
        prix_unitaire: number
        montant_total: number
    }[]
}

export function useCreateRetourPos() {
    const supabase = createClient()
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (data: CreateRetourPosData) => {
            let finalCommercialId = data.commercial_id
            if (!finalCommercialId || finalCommercialId.trim() === "") {
                const { data: { user } } = await supabase.auth.getUser()
                if (user?.id) {
                    const { data: userProfile } = await (supabase.from("profiles") as any)
                        .select("id")
                        .eq("user_id", user.id)
                        .maybeSingle()
                    finalCommercialId = (userProfile as any)?.id
                }
                if (!finalCommercialId) {
                    const { data: defaultProfile } = await (supabase.from("profiles") as any)
                        .select("id")
                        .limit(1)
                        .maybeSingle()
                    finalCommercialId = (defaultProfile as any)?.id
                }
            }

            let numero = null
            try {
                const { data: nextNum } = await (supabase.rpc as any)("next_numero", { p_type: "retour_pos" })
                numero = nextNum
            } catch (err) {
                console.warn("RPC next_numero for retour_pos error:", err)
            }

            const { data: ret, error } = await (supabase.from("retours_pos") as any)
                .insert({
                    numero: numero || `RET-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
                    date: new Date().toISOString().split("T")[0],
                    vente_pos_id: data.vente_pos_id || null,
                    client_id: data.client_id || null,
                    commercial_id: finalCommercialId,
                    depot_id: data.depot_id,
                    tresorerie_id: data.tresorerie_id,
                    montant_total: data.montant_total,
                    mode_remboursement: data.mode_remboursement,
                    motif: data.motif || null,
                })
                .select()
                .single()
            if (error) {
                console.error("retours_pos insert error:", error)
                throw new Error(error.message || "Erreur lors de la création du retour")
            }

            const lignesData = data.lignes.map((l) => ({
                retour_pos_id: (ret as any).id,
                article_id: l.article_id,
                designation: l.designation,
                quantite: Number(l.quantite),
                prix_unitaire: Number(l.prix_unitaire),
                montant_total: Number(l.montant_total),
            }))

            const { error: le } = await (supabase.from("retour_pos_lignes") as any).insert(lignesData)
            if (le) {
                console.error("retour_pos_lignes insert error:", le)
                throw new Error(le.message || "Erreur lors de l'enregistrement des articles retournés")
            }

            // 1. Restock returned articles into depot
            for (const l of data.lignes) {
                try {
                    await (supabase.rpc as any)("update_stock", {
                        p_article_id: l.article_id,
                        p_depot_id: data.depot_id,
                        p_quantite: Number(l.quantite),
                        p_type: "entree",
                        p_reference_type: "retour_pos",
                        p_reference_id: (ret as any).id,
                        p_inclure_tva: false
                    })
                } catch (stkErr) {
                    console.warn("Stock restore for POS return error:", stkErr)
                }
            }

            // 2. Register refund payment outflow in paiements (credits customer, debits treasury)
            if (data.montant_total > 0 && data.tresorerie_id) {
                try {
                    await (supabase.from("paiements") as any).insert({
                        date: new Date().toISOString().split("T")[0],
                        montant: Number(data.montant_total),
                        mode_paiement: data.mode_remboursement || "especes",
                        tresorerie_id: data.tresorerie_id,
                        reference_type: "retour_pos",
                        reference_id: (ret as any).id,
                        note: `Remboursement Retour POS N° ${(ret as any).numero}`,
                        statut_versement: "encaisse"
                    })
                } catch (pe) {
                    console.warn("Refund payment insert error for POS return:", pe)
                }
            }

            return ret
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["ventes-pos"] })
            queryClient.invalidateQueries({ queryKey: ["pos-sold-articles"] })
            queryClient.invalidateQueries({ queryKey: ["retours-pos"] })
            queryClient.invalidateQueries({ queryKey: ["articles-active-pos"] })
            queryClient.invalidateQueries({ queryKey: ["stock"] })
            queryClient.invalidateQueries({ queryKey: ["tresoreries"] })
            queryClient.invalidateQueries({ queryKey: ["mouvements_tresorerie"] })
            queryClient.invalidateQueries({ queryKey: ["operations"] })
        },
    })
}

export function useRetoursPosList() {
    const supabase = createClient()
    return useQuery({
        queryKey: ["retours-pos"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("retours_pos")
                .select("*, client:clients(*), commercial:profiles(*), tresorerie:tresoreries(*), depot:depots(*), vente_pos:ventes_pos(*), lignes:retour_pos_lignes(*, article:articles(*))")
                .order("created_at", { ascending: false })
            if (error) throw error
            return data as any[]
        },
    })
}
