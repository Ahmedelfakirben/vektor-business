"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { BonLivraison } from "@/types/database"
import { useFiscalMode } from "@/providers/fiscal-mode-context"

export function useCreances() {
    const supabase = createClient()
    const { fiscalMode } = useFiscalMode()

    return useQuery({
        queryKey: ["creances", fiscalMode],
        queryFn: async () => {
            let query = supabase
                .from("bon_livraisons")
                .select("*, client:clients(raison_sociale, code)")
                .neq("statut_paiement", "paye") 
                .eq("statut", "valide")

            if (fiscalMode) {
                query = query.eq("inclure_tva", true)
            }

            const { data, error } = await query.order("date", { ascending: true })

            if (error) throw error
            return data as BonLivraison[]
        },
    })
}
