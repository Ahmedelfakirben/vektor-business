"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { MouvementTresorerie, Tresorerie } from "@/types/database"

export function useMouvementsTresorerie(tresorerieId: string) {
    const supabase = createClient()

    return useQuery({
        queryKey: ["mouvements_tresorerie", tresorerieId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("v_mouvements_tresorerie_complets")
                .select("*")
                .eq("tresorerie_id", tresorerieId)
                .order("created_at", { ascending: false })

            if (error) throw error
            // Cast to any because the view type isn't in Database definition yet
            // but we know it matches MouvementTresorerie + source fields
            return data as any[]
        },
        enabled: !!tresorerieId
    })
}

export function useTresorerie(id: string) {
    const supabase = createClient()

    return useQuery({
        queryKey: ["tresorerie", id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("tresoreries")
                .select("*")
                .eq("id", id)
                .single()

            if (error) throw error
            return data as Tresorerie
        },
        enabled: !!id
    })
}
