"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { MouvementTresorerie } from "@/types/database"
import type { MouvementTresorerieFormData } from "@/lib/validations/operations"

export function useMouvementTresorerieList() {
    const supabase = createClient()
    return useQuery({
        queryKey: ["mouvements-tresorerie"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("mouvements_tresorerie")
                .select("*, tresorerie:tresoreries(*)")
                .order("created_at", { ascending: false })
                .limit(200)
            if (error) throw error
            return data as MouvementTresorerie[]
        },
    })
}

export function useCreateMouvementTresorerie() {
    const supabase = createClient()
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (formData: MouvementTresorerieFormData) => {
            const { data, error } = await supabase
                .from("mouvements_tresorerie")
                .insert({
                    tresorerie_id: formData.tresorerie_id,
                    type: formData.type,
                    montant: formData.montant,
                    libelle: formData.libelle,
                    reference_type: formData.reference_type || null,
                    reference_id: formData.reference_id || null,
                } as any)
                .select().single()
            if (error) throw error
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["mouvements-tresorerie"] })
            queryClient.invalidateQueries({ queryKey: ["tresoreries"] })
        },
    })
}
