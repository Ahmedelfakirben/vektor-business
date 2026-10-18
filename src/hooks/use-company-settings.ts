"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

export interface CompanyInfo {
  nom: string
  adresse: string
  telephone: string
  email: string
  ice: string
}

export const DEFAULT_COMPANY_INFO: CompanyInfo = {
  nom: "Linventory",
  adresse: "Casablanca, Maroc",
  telephone: "+212 5XX-XXXXXX",
  email: "contact@linventory.com",
  ice: "000000000000000",
}

export function getCompanySettingsSync(): CompanyInfo {
  if (typeof window === "undefined") return DEFAULT_COMPANY_INFO
  try {
    const raw = localStorage.getItem("company_info")
    if (raw) {
      const parsed = JSON.parse(raw)
      return { ...DEFAULT_COMPANY_INFO, ...parsed }
    }
  } catch {}
  return DEFAULT_COMPANY_INFO
}

export function useCompanySettings() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ["company_settings"],
    queryFn: async () => {
      // 1. Try Supabase parametres table
      try {
        const { data, error } = await (supabase
          .from("parametres") as any)
          .select("valeur")
          .eq("cle", "company_info")
          .maybeSingle()

        if (!error && (data as any)?.valeur) {
          const rawVal = (data as any).valeur
          const parsed = typeof rawVal === "string" ? JSON.parse(rawVal) : rawVal
          const info: CompanyInfo = { ...DEFAULT_COMPANY_INFO, ...parsed }
          if (typeof window !== "undefined") {
            localStorage.setItem("company_info", JSON.stringify(info))
          }
          return info
        }
      } catch (err) {
        console.warn("Could not fetch company settings from Supabase:", err)
      }

      // 2. Fallback to localStorage
      return getCompanySettingsSync()
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  const updateMutation = useMutation({
    mutationFn: async (newInfo: Partial<CompanyInfo>) => {
      const current = query.data || getCompanySettingsSync()
      const merged: CompanyInfo = { ...current, ...newInfo }

      // Update localStorage immediately
      if (typeof window !== "undefined") {
        localStorage.setItem("company_info", JSON.stringify(merged))
      }

      // Save to Supabase parametres
      try {
        const { error } = await (supabase.from("parametres") as any).upsert({
          cle: "company_info",
          valeur: JSON.stringify(merged),
          description: "Informations de la société (Nom, adresse, ICE, téléphone)",
          updated_at: new Date().toISOString(),
        })
        if (error) {
          console.error("Supabase parametres upsert error:", error)
        }
      } catch (err) {
        console.error("Failed to persist company settings to Supabase:", err)
      }

      return merged
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["company_settings"], data)
      queryClient.invalidateQueries({ queryKey: ["company_settings"] })
    },
  })

  return {
    company: query.data || getCompanySettingsSync(),
    isLoading: query.isLoading,
    saveCompany: updateMutation.mutateAsync,
    isSaving: updateMutation.isPending,
  }
}
