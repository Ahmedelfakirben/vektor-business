"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { Devis } from "@/types/database"
import type { DevisFormData } from "@/lib/validations/documents"
import { useFiscalMode } from "@/providers/fiscal-mode-context"

export function useDevisList() {
  const supabase = createClient()
  const { fiscalMode } = useFiscalMode()

  return useQuery({
    queryKey: ["devis", fiscalMode],
    queryFn: async () => {
      let query = supabase
        .from("devis")
        .select("*, client:clients(*), commercial:profiles(*)")
      
      if (fiscalMode) {
        query = query.eq("inclure_tva", true)
      }

      const { data, error } = await query.order("created_at", { ascending: false })
      if (error) throw error
      return data as Devis[]
    },
  })
}

export function useDevis(id: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ["devis", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("devis")
        .select("*, client:clients(*), commercial:profiles(*), lignes:devis_lignes(*, article:articles(*))")
        .eq("id", id)
        .single()
      if (error) throw error
      return data as Devis
    },
    enabled: !!id,
  })
}

export function useDevisByClient(client_id: string) {
  const supabase = createClient()
  const { fiscalMode } = useFiscalMode()
  
  return useQuery({
    queryKey: ["devis", "client", client_id, fiscalMode],
    queryFn: async () => {
      let query = supabase
        .from("devis")
        .select("*, client:clients(*), commercial:profiles(*)")
        .eq("client_id", client_id)
      
      if (fiscalMode) {
        query = query.eq("inclure_tva", true)
      }

      const { data, error } = await query.order("created_at", { ascending: false })
      if (error) throw error
      return data as Devis[]
    },
    enabled: !!client_id,
  })
}

export function useCreateDevis() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (formData: DevisFormData) => {
      // Get current user profile
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Non authentifié")

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single()
      if (!profile) throw new Error("Profil introuvable")

      // Get next numero
      const { data: numero } = await (supabase.rpc as any)("next_numero", { p_type: "devis" })

      const lignes = formData.lignes
      const montant_ttc = lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0)
      const montant_ht = formData.inclure_tva
        ? lignes.reduce((s, l) => s + (l.quantite * l.prix_unitaire) / (1 + l.tva / 100), 0)
        : montant_ttc
      const montant_tva = montant_ttc - montant_ht

      // Create devis
      const { data: devis, error } = await (supabase
        .from("devis") as any)
        .insert({
          numero: numero || `DEV-${Date.now()}`,
          date: formData.date,
          client_id: formData.client_id,
          commercial_id: (profile as any).id,
          statut: "brouillon",
          montant_ht,
          montant_tva,
          montant_ttc,
          notes: formData.notes || null,
          validite_jours: formData.validite_jours,
          inclure_tva: formData.inclure_tva,
          is_regularisation: formData.is_regularisation || false,
        })
        .select()
        .single()
      if (error) throw error

      // Create lines
      const lignesData = lignes.map((l, i) => {
        const line_ttc = l.quantite * l.prix_unitaire
        const line_ht = formData.inclure_tva ? line_ttc / (1 + l.tva / 100) : line_ttc
        return {
          devis_id: (devis as any).id,
          article_id: l.article_id || null,
          designation: l.designation,
          quantite: l.quantite,
          prix_unitaire: l.prix_unitaire,
          tva: l.tva,
          montant_ht: line_ht,
          is_regularisation: formData.is_regularisation || false,
          ordre: i,
        }
      })

      const { error: lignesError } = await (supabase
        .from("devis_lignes") as any)
        .insert(lignesData)
      if (lignesError) throw lignesError

      return devis
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devis"] })
    },
  })
}

export function useUpdateDevis() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data: formData }: { id: string; data: DevisFormData }) => {
      const lignes = formData.lignes
      const montant_ttc = lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0)
      const montant_ht = formData.inclure_tva
        ? lignes.reduce((s, l) => s + (l.quantite * l.prix_unitaire) / (1 + l.tva / 100), 0)
        : montant_ttc
      const montant_tva = montant_ttc - montant_ht

      // Update devis
      const { data: devis, error } = await (supabase
        .from("devis") as any)
        .update({
          date: formData.date,
          client_id: formData.client_id,
          montant_ht,
          montant_tva,
          montant_ttc,
          notes: formData.notes || null,
          validite_jours: formData.validite_jours,
          inclure_tva: formData.inclure_tva,
          is_regularisation: formData.is_regularisation || false,
        })
        .eq("id", id)
        .select()
        .single()
      if (error) throw error

      // Delete existing lines and re-insert
      await (supabase.from("devis_lignes") as any).delete().eq("devis_id", id)

      const lignesData = lignes.map((l, i) => {
        const line_ttc = l.quantite * l.prix_unitaire
        const line_ht = formData.inclure_tva ? line_ttc / (1 + l.tva / 100) : line_ttc
        return {
          devis_id: id,
          article_id: l.article_id || null,
          designation: l.designation,
          quantite: l.quantite,
          prix_unitaire: l.prix_unitaire,
          tva: l.tva,
          montant_ht: line_ht,
          is_regularisation: formData.is_regularisation || false,
          ordre: i,
        }
      })

      const { error: lignesError } = await (supabase
        .from("devis_lignes") as any)
        .insert(lignesData)
      if (lignesError) throw lignesError

      return devis
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devis"] })
    },
  })
}

export function useUpdateDevisStatut() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, statut }: { id: string; statut: string }) => {
      if (statut === "accepte") {
        // Get first depot as default (or prompt user in future)
        const { data: depots } = await (supabase
          .from("depots") as any)
          .select("id")
          .limit(1)
        const depot_id = depots?.[0]?.id

        if (!depot_id) throw new Error("Aucun dépôt trouvé. Créez un dépôt avant d'accepter un devis.")

        // Call RPC to atomic accept
        const { error } = await (supabase.rpc as any)("accept_devis", {
          p_devis_id: id,
          p_depot_id: depot_id
        })
        if (error) throw error
      } else {
        // Normal update for other statuses
        const { error } = await (supabase
          .from("devis") as any)
          .update({ statut })
          .eq("id", id)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devis"] })
      queryClient.invalidateQueries({ queryKey: ["bon-livraisons"] })
    },
  })
}

export function useToggleDevisTVA() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, inclure_tva }: { id: string; inclure_tva: boolean }) => {
      // 1. Get current devis and lines
      const { data: devis, error: devisError } = await supabase
        .from("devis")
        .select("*, lignes:devis_lignes(*)")
        .eq("id", id)
        .single()
      if (devisError) throw devisError

      const lignes = (devis as any).lignes || []
      const montant_ttc = lignes.reduce((s: number, l: any) => s + l.quantite * l.prix_unitaire, 0)
      const montant_ht = inclure_tva
        ? lignes.reduce((s: number, l: any) => s + (l.quantite * l.prix_unitaire) / (1 + l.tva / 100), 0)
        : montant_ttc
      const montant_tva = montant_ttc - montant_ht

      // 2. Update devis
      const { error: updateError } = await (supabase
        .from("devis") as any)
        .update({
          inclure_tva,
          montant_ht,
          montant_tva,
          montant_ttc
        })
        .eq("id", id)
      if (updateError) throw updateError

      // 3. Update lines montant_ht
      for (const l of lignes) {
        const line_ttc = l.quantite * l.prix_unitaire
        const line_ht = inclure_tva ? line_ttc / (1 + l.tva / 100) : line_ttc
        await (supabase.from("devis_lignes") as any).update({ montant_ht: line_ht }).eq("id", l.id)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devis"] })
    },
  })
}

export function useDeleteDevis() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("devis").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devis"] })
    },
  })
}
