"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { BonLivraison } from "@/types/database"
import type { BonLivraisonFormData } from "@/lib/validations/documents"
import { useFiscalMode } from "@/providers/fiscal-mode-context"
import { cleanEmptyStrings } from "@/lib/utils"

export function useBonLivraisonList() {
    const supabase = createClient()
    const { fiscalMode } = useFiscalMode()

    return useQuery({
        queryKey: ["bon-livraisons", fiscalMode],
        queryFn: async () => {
            let query = supabase
                .from("bon_livraisons")
                .select("*, client:clients(*), depot:depots(*)")
            
            if (fiscalMode) {
                query = query.eq("inclure_tva", true)
            }

            const { data, error } = await query.order("created_at", { ascending: false })
            if (error) throw error
            return data as BonLivraison[]
        },
    })
}

export function useBonLivraison(id: string) {
    const supabase = createClient()

    return useQuery({
        queryKey: ["bon-livraisons", id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("bon_livraisons")
                .select("*, client:clients(*), depot:depots(*), lignes:bon_livraison_lignes(*, article:articles(*))")
                .eq("id", id)
                .single()
            if (error) throw error
            return data as BonLivraison
        },
        enabled: !!id,
    })
}

export function useBonLivraisonsByClient(client_id: string) {
    const supabase = createClient()
    const { fiscalMode } = useFiscalMode()

    return useQuery({
        queryKey: ["bon-livraisons", "client", client_id, fiscalMode],
        queryFn: async () => {
            let query = supabase
                .from("bon_livraisons")
                .select("*, client:clients(*), depot:depots(*)")
                .eq("client_id", client_id)
            
            if (fiscalMode) {
                query = query.eq("inclure_tva", true)
            }

            const { data, error } = await query.order("created_at", { ascending: false })
            if (error) throw error
            return data as BonLivraison[]
        },
        enabled: !!client_id,
    })
}

export function useCreateBonLivraison() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (formData: BonLivraisonFormData) => {
            const lignes = formData.lignes
            const montant_ttc = lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0)
            const montant_ht = formData.inclure_tva
                ? lignes.reduce((s, l) => s + (l.quantite * l.prix_unitaire) / (1 + l.tva / 100), 0)
                : montant_ttc
            const montant_tva = montant_ttc - montant_ht

            const { data: numero } = await (supabase.rpc as any)("next_numero", { p_type: "bon_livraison" })

            const { data: bl, error } = await (supabase
                .from("bon_livraisons") as any)
                .insert({
                    numero: numero || `BL-${Date.now()}`,
                    date: formData.date,
                    client_id: formData.client_id,
                    devis_id: formData.devis_id || null,
                    depot_id: formData.depot_id,
                    statut: "valide",
                    montant_ht,
                    montant_tva,
                    montant_ttc,
                    notes: formData.notes || null,
                    inclure_tva: formData.inclure_tva,
                    is_regularisation: formData.is_regularisation || false,
                })
                .select()
                .single()
            if (error) throw error

            const lignesData = lignes.map((l, i) => {
                const line_ttc = l.quantite * l.prix_unitaire
                const line_ht = formData.inclure_tva ? line_ttc / (1 + l.tva / 100) : line_ttc
                return {
                    bon_livraison_id: (bl as any).id,
                    article_id: l.article_id || null,
                    designation: l.designation,
                    quantite: l.quantite,
                    prix_unitaire: l.prix_unitaire,
                    tva: l.tva,
                    montant_ht: line_ht,
                    codes_articles: l.codes_articles || [],
                    is_regularisation: formData.is_regularisation || false,
                    ordre: i,
                }
            })

            const { error: lignesError } = await (supabase
                .from("bon_livraison_lignes") as any)
                .insert(lignesData)
            if (lignesError) throw lignesError

            // Insert initial payments
            if (formData.paiements && formData.paiements.length > 0) {
                const paiementsData = formData.paiements.map(p => cleanEmptyStrings({
                    date: p.date,
                    montant: p.montant,
                    mode_paiement: p.mode_paiement,
                    tresorerie_id: p.tresorerie_id,
                    reference_type: "bon_livraison",
                    reference_id: (bl as any).id,
                    note: p.note,
                    reference_paiement: p.reference_paiement,
                    date_echeance: p.date_echeance,
                }))
                const { error: pError } = await (supabase.from("paiements") as any).insert(paiementsData)
                if (pError) throw pError
            }

            // Triggers handle stock if status is 'valide' on insertion (already verified in 00022)
            // But we keep the manual RPC call if existing triggers only handle UPDATE
            // Checked 00022 and 00013: on_bon_livraison_valide handles (OLD.statut IS NULL OR OLD.statut = 'brouillon')
            // So immediate validation on INSERT is covered by the trigger.

            return bl
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bon-livraisons"] })
        },
    })
}

export function useUpdateBonLivraison() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ id, data: formData }: { id: string; data: BonLivraisonFormData }) => {
            const lignes = formData.lignes
            const montant_ttc = lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0)
            const montant_ht = formData.inclure_tva
                ? lignes.reduce((s, l) => s + (l.quantite * l.prix_unitaire) / (1 + l.tva / 100), 0)
                : montant_ttc
            const montant_tva = montant_ttc - montant_ht

            const { data: bl, error } = await (supabase
                .from("bon_livraisons") as any)
                .update({
                    date: formData.date,
                    client_id: formData.client_id,
                    devis_id: formData.devis_id || null,
                    depot_id: formData.depot_id,
                    montant_ht,
                    montant_tva,
                    montant_ttc,
                    notes: formData.notes || null,
                    inclure_tva: formData.inclure_tva,
                    is_regularisation: formData.is_regularisation || false,
                })
                .eq("id", id)
                .select()
                .single()
            if (error) throw error

            await supabase.from("bon_livraison_lignes").delete().eq("bon_livraison_id", id)

            const lignesData = lignes.map((l, i) => {
                const line_ttc = l.quantite * l.prix_unitaire
                const line_ht = formData.inclure_tva ? line_ttc / (1 + l.tva / 100) : line_ttc
                return {
                    bon_livraison_id: id,
                    article_id: l.article_id || null,
                    designation: l.designation,
                    quantite: l.quantite,
                    prix_unitaire: l.prix_unitaire,
                    tva: l.tva,
                    montant_ht: line_ht,
                    is_regularisation: formData.is_regularisation || false,
                    ordre: i,
                }
            })

            const { error: lignesError } = await (supabase
                .from("bon_livraison_lignes") as any)
                .insert(lignesData)
            if (lignesError) throw lignesError

            return bl
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bon-livraisons"] })
        },
    })
}

export function useUpdateBonLivraisonStatut() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ id, statut }: { id: string; statut: string }) => {
            const { error } = await (supabase
                .from("bon_livraisons") as any)
                .update({ statut })
                .eq("id", id)
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bon-livraisons"] })
        },
    })
}

export function useToggleBonLivraisonTVA() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ id, inclure_tva }: { id: string; inclure_tva: boolean }) => {
            const { data: bl, error: blError } = await supabase
                .from("bon_livraisons")
                .select("*, lignes:bon_livraison_lignes(*)")
                .eq("id", id)
                .single()
            if (blError) throw blError

            const lignes = (bl as any).lignes || []
            const montant_ttc = lignes.reduce((s: number, l: any) => s + l.quantite * l.prix_unitaire, 0)
            const montant_ht = inclure_tva
                ? lignes.reduce((s: number, l: any) => s + (l.quantite * l.prix_unitaire) / (1 + l.tva / 100), 0)
                : montant_ttc
            const montant_tva = montant_ttc - montant_ht

            const { error: updateError } = await (supabase
                .from("bon_livraisons") as any)
                .update({
                    inclure_tva,
                    montant_ht,
                    montant_tva,
                    montant_ttc
                })
                .eq("id", id)
            if (updateError) throw updateError

            for (const l of lignes) {
                const line_ttc = l.quantite * l.prix_unitaire
                const line_ht = inclure_tva ? line_ttc / (1 + l.tva / 100) : line_ttc
                await (supabase.from("bon_livraison_lignes") as any).update({ montant_ht: line_ht }).eq("id", l.id)
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bon-livraisons"] })
        },
    })
}

export function useDeleteBonLivraison() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("bon_livraisons").delete().eq("id", id)
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bon-livraisons"] })
        },
    })
}
