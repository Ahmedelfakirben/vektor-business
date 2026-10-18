import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { SousFamilleArticle } from "@/types/database"

export function useSousFamilles() {
  const supabase = createClient()
  return useQuery({
    queryKey: ["sous-familles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sous_familles_articles")
        .select("*, famille:familles_articles(*)")
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as any[] as SousFamilleArticle[]
    },
  })
}

export function useSousFamillesByFamille(familleId: string) {
  const supabase = createClient()
  return useQuery({
    queryKey: ["sous-familles", familleId],
    queryFn: async () => {
      if (!familleId) return []
      const { data, error } = await supabase
        .from("sous_familles_articles")
        .select("*")
        .eq("famille_id", familleId)
        .order("libelle", { ascending: true })
      if (error) throw error
      return data as any[] as SousFamilleArticle[]
    },
    enabled: !!familleId,
  })
}

export function useCreateSousFamille() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (sousFamille: Omit<SousFamilleArticle, "id" | "created_at" | "famille">) => {
      const { data, error } = await (supabase
        .from("sous_familles_articles") as any)
        .insert(sousFamille as any)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sous-familles"] })
    },
  })
}

export function useUpdateSousFamille() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SousFamilleArticle> & { id: string }) => {
      // Remove relation fields before update
      const { famille, ...cleanUpdates } = updates as any
      const { data, error } = await (supabase
        .from("sous_familles_articles") as any)
        .update(cleanUpdates)
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sous-familles"] })
    },
  })
}

export function useDeleteSousFamille() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("sous_familles_articles") as any).delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sous-familles"] })
    },
  })
}
