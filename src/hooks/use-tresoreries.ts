"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { Tresorerie } from "@/types/database"
import type { TresorerieFormData } from "@/lib/validations/master-data"

export function useTresoreries() {
    const supabase = createClient()

    return useQuery({
        queryKey: ["tresoreries"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("tresoreries")
                .select("*")
                .order("libelle")
            if (error) throw error
            return data as Tresorerie[]
        },
    })
}

export function useTresorerie(id: string) {
    const supabase = createClient()

    return useQuery({
        queryKey: ["tresoreries", id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("tresoreries")
                .select("*")
                .eq("id", id)
                .single()
            if (error) throw error
            return data as Tresorerie
        },
        enabled: !!id,
    })
}

export function useCreateTresorerie() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (data: TresorerieFormData) => {
            // Robust code generation like BL/BA
            let code = data.code
            if (!code || code === "") {
                const { data: nextCode } = await (supabase.rpc as any)("next_numero", { p_type: "tresorerie" })
                code = nextCode
            }

            const cleanData = Object.fromEntries(
                Object.entries({ ...data, code }).map(([k, v]) => [k, v === "" ? null : v])
            )
            const { data: result, error } = await supabase
                .from("tresoreries")
                .insert(cleanData as any)
                .select()
                .single()
            if (error) throw error
            return result
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tresoreries"] })
        },
    })
}

export function useUpdateTresorerie() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: TresorerieFormData }) => {
            const { data: result, error } = await (supabase
                .from("tresoreries") as any)
                .update(data)
                .eq("id", id)
                .select()
                .single()
            if (error) throw error
            return result
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tresoreries"] })
        },
    })
}

export function useDeleteTresorerie() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("tresoreries").delete().eq("id", id)
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tresoreries"] })
        },
    })
}
