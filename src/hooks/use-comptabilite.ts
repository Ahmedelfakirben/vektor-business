"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { useFiscalMode } from "@/providers/fiscal-mode-context"

export function useBalanceGenerale() {
    const supabase = createClient()
    const { fiscalMode } = useFiscalMode()

    return useQuery({
        queryKey: ["balance_generale", fiscalMode],
        queryFn: async () => {
            const table = fiscalMode ? "v_balance_generale_fiscal" : "v_balance_generale"
            const { data, error } = await supabase
                .from(table)
                .select("*")
                .order("compte", { ascending: true })
            if (error) throw error
            return data
        }
    })
}

export function useGrandLivre() {
    const supabase = createClient()
    const { fiscalMode } = useFiscalMode()

    return useQuery({
        queryKey: ["grand_livre", fiscalMode],
        queryFn: async () => {
            let query = supabase
                .from("v_grand_livre")
                .select("*")

            if (fiscalMode) {
                query = query.eq("inclure_tva", true)
            }

            const { data, error } = await query
                .order("date", { ascending: false })
                .limit(500)
            if (error) throw error
            return data
        }
    })
}
