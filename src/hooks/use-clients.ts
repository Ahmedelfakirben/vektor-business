"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { Client } from "@/types/database"
import type { ClientFormData } from "@/lib/validations/master-data"

export function useClients() {
  const supabase = createClient()

  return useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("raison_sociale")
      if (error) throw error
      return data as Client[]
    },
  })
}

export function useClient(id: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ["clients", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id)
        .single()
      if (error) throw error
      return data as Client
    },
    enabled: !!id,
  })
}

export function useCreateClient() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: ClientFormData) => {
      // Robust code generation like BL/BA
      let code = data.code
      if (!code || code === "" || code === "Génération auto...") {
        const { data: nextCode } = await (supabase.rpc as any)("next_numero", { p_type: "client" })
        code = nextCode
      }

      const cleanData = Object.fromEntries(
        Object.entries({ ...data, code }).map(([k, v]) => [k, v === "" ? null : v])
      )
      const { data: result, error } = await supabase
        .from("clients")
        .insert(cleanData as any)
        .select()
        .single()
      if (error) throw error
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] })
    },
  })
}

export function useUpdateClient() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ClientFormData }) => {
      const { data: result, error } = await (supabase
        .from("clients") as any)
        .update(data)
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] })
    },
  })
}

export function useDeleteClient() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] })
    },
  })
}
