"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { Salarie } from "@/types/database"
import type { SalarieFormData } from "@/lib/validations/master-data"

export function useSalaries() {
    const supabase = createClient()

    return useQuery({
        queryKey: ["salaries"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("salaries")
                .select("*")
                .order("nom")
            if (error) throw error
            return data as Salarie[]
        },
    })
}

export function useSalarie(id: string) {
    const supabase = createClient()

    return useQuery({
        queryKey: ["salaries", id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("salaries")
                .select("*")
                .eq("id", id)
                .single()
            if (error) throw error
            return data as Salarie
        },
        enabled: !!id,
    })
}

export function useCreateSalarie() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (data: SalarieFormData) => {
            // Robust code generation like BL/BA
            let matricule = data.matricule
            if (!matricule || matricule === "") {
                const { data: nextCode } = await (supabase.rpc as any)("next_numero", { p_type: "salarie" })
                matricule = nextCode
            }

            const { data: result, error } = await supabase
                .from("salaries")
                .insert({ ...data, matricule } as any)
                .select()
                .single()
            if (error) throw error
            return result
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["salaries"] })
        },
    })
}

export function useUpdateSalarie() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: SalarieFormData }) => {
            const { data: result, error } = await (supabase
                .from("salaries") as any)
                .update(data)
                .eq("id", id)
                .select()
                .single()
            if (error) throw error
            return result
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["salaries"] })
        },
    })
}

export function useDeleteSalarie() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("salaries").delete().eq("id", id)
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["salaries"] })
        },
    })
}
