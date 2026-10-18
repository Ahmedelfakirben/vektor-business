"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

export function useNextCode(table: "clients" | "fournisseurs" | "familles_articles" | "depots" | "articles", prefix: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ["next-code", table],
    queryFn: async () => {
      // Map frontend table names to backend sequence types
      let type = ""
      if (table === "clients") type = "client"
      else if (table === "fournisseurs") type = "fournisseur"
      else if (table === "articles") type = "article"
      else if (table === "familles_articles") type = "famille_article"
      else if (table === "depots") type = "depot"

      const { data, error } = await (supabase.rpc as any)("next_numero", { p_type: type })
      
      if (error) {
        console.error("Error fetching next code via RPC:", error)
        return `${prefix}001`
      }

      return data as string
    },
    // We don't want to refetch and increment the sequence unnecessarily
    staleTime: Infinity,
    gcTime: 0,
  })
}
