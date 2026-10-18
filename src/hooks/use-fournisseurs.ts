"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { Fournisseur } from "@/types/database"
import type { FournisseurFormData } from "@/lib/validations/master-data"

export function useFournisseurs() {
  const supabase = createClient()

  return useQuery({
    queryKey: ["fournisseurs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fournisseurs")
        .select("*")
        .order("raison_sociale")
      if (error) throw error
      return data as Fournisseur[]
    },
  })
}

export function useFournisseur(id: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ["fournisseurs", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fournisseurs")
        .select("*")
        .eq("id", id)
        .single()
      if (error) throw error
      return data as Fournisseur
    },
    enabled: !!id,
  })
}

export function useCreateFournisseur() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: FournisseurFormData) => {
      // Robust code generation like BL/BA
      let code = data.code
      if (!code || code === "" || code === "Génération auto...") {
        const { data: nextCode } = await (supabase.rpc as any)("next_numero", { p_type: "fournisseur" })
        code = nextCode
      }

      const { data: result, error } = await supabase
        .from("fournisseurs")
        .insert({ ...data, code } as any)
        .select()
        .single()
      if (error) throw error
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fournisseurs"] })
    },
  })
}

export function useUpdateFournisseur() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FournisseurFormData }) => {
      const { data: result, error } = await (supabase
        .from("fournisseurs") as any)
        .update(data)
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fournisseurs"] })
    },
  })
}

export function useDeleteFournisseur() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fournisseurs").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fournisseurs"] })
    },
  })
}
