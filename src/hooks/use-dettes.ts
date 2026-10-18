"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { BonAchat } from "@/types/database"
import { useFiscalMode } from "@/providers/fiscal-mode-context"

export function useDettes() {
    const supabase = createClient()
    const { fiscalMode } = useFiscalMode()

    return useQuery({
        queryKey: ["dettes", fiscalMode],
        queryFn: async () => {
            let query = supabase
                .from("bon_achats")
                .select("*, fournisseur:fournisseurs(raison_sociale, code)")
                .neq("statut_paiement", "paye")
                .eq("statut", "valide")

            if (fiscalMode) {
                query = query.eq("inclure_tva", true)
            }

            const { data, error } = await query.order("date", { ascending: true })

            if (error) throw error
            return data as BonAchat[]
        },
    })
}
