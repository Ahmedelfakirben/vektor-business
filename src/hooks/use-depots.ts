"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { Depot } from "@/types/database"
import type { DepotFormData } from "@/lib/validations/master-data"

export function useDepots() {
    const supabase = createClient()

    return useQuery({
        queryKey: ["depots"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("depots")
                .select("*")
                .order("libelle")
            if (error) throw error
            return data as Depot[]
        },
    })
}

export function useDepot(id: string) {
    const supabase = createClient()

    return useQuery({
        queryKey: ["depots", id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("depots")
                .select("*")
                .eq("id", id)
                .single()
            if (error) throw error
            return data as Depot
        },
        enabled: !!id,
    })
}

export function useCreateDepot() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (data: DepotFormData) => {
            // Robust code generation like BL/BA
            let code = data.code
            if (!code || code === "" || code === "Génération auto...") {
                const { data: nextCode } = await (supabase.rpc as any)("next_numero", { p_type: "depot" })
                code = nextCode
            }

            const cleanData = Object.fromEntries(
                Object.entries({ ...data, code }).map(([k, v]) => [k, v === "" ? null : v])
            )
            const { data: result, error } = await supabase
                .from("depots")
                .insert(cleanData as any)
                .select()
                .single()
            if (error) throw error
            return result
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["depots"] })
        },
    })
}

export function useUpdateDepot() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: DepotFormData }) => {
            const { data: result, error } = await (supabase
                .from("depots") as any)
                .update(data)
                .eq("id", id)
                .select()
                .single()
            if (error) throw error
            return result
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["depots"] })
        },
    })
}

export function useDeleteDepot() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("depots").delete().eq("id", id)
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["depots"] })
        },
    })
}
