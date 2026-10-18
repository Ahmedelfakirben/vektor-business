import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { Depense } from "@/types/database"

export function useDepenses() {
  const supabase = createClient()
  return useQuery({
    queryKey: ["depenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("depenses")
        .select("*, tresorerie:tresoreries(*)")
        .order("date", { ascending: false })
      if (error) throw error
      return data as any[] as Depense[]
    },
  })
}

export function useCreateDepense() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (depense: Omit<Depense, "id" | "created_at" | "tresorerie">) => {
      const { data, error } = await supabase
        .from("depenses")
        .insert(depense as any)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["depenses"] })
      queryClient.invalidateQueries({ queryKey: ["tresoreries"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

export function useDeleteDepense() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("depenses").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["depenses"] })
      queryClient.invalidateQueries({ queryKey: ["tresoreries"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}
