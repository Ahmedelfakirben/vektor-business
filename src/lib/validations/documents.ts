import { z } from "zod"

const documentLigneSchema = z.object({
  id: z.string().optional(),
  article_id: z.string().nullable().optional(),
  designation: z.string().min(1, "La désignation est obligatoire"),
  quantite: z.coerce.number().min(0.01, "La quantité doit être supérieure à 0"),
  prix_unitaire: z.coerce.number().min(0, "Le prix doit être positif"),
  tva: z.coerce.number().min(0).max(100).default(20),
  montant_ht: z.coerce.number().default(0),
  codes_articles: z.array(z.string()).default([]),
  ordre: z.coerce.number().default(0),
})

export type DocumentLigneFormData = z.infer<typeof documentLigneSchema>

export const devisSchema = z.object({
  date: z.string().min(1, "La date est obligatoire"),
  client_id: z.string().min(1, "Le client est obligatoire"),
  notes: z.string().optional().nullable(),
  validite_jours: z.coerce.number().int().min(1).default(30),
  inclure_tva: z.boolean().default(false),
  is_regularisation: z.boolean().default(false),
  lignes: z.array(documentLigneSchema).min(1, "Au moins une ligne est requise"),
})

export type DevisFormData = z.infer<typeof devisSchema>

export const bonLivraisonSchema = z.object({
  date: z.string().min(1, "La date est obligatoire"),
  client_id: z.string().min(1, "Le client est obligatoire"),
  devis_id: z.string().optional().nullable(),
  depot_id: z.string().min(1, "Le dépôt est obligatoire"),
  notes: z.string().optional().nullable(),
  inclure_tva: z.boolean().default(false),
  is_regularisation: z.boolean().default(false),
  lignes: z.array(documentLigneSchema).min(1, "Au moins une ligne est requise"),
  paiements: z.array(z.any()).optional().default([]), // Will use PaiementFormData
})

export type BonLivraisonFormData = z.infer<typeof bonLivraisonSchema>

export const bonRetourSchema = z.object({
  date: z.string().min(1, "La date est obligatoire"),
  client_id: z.string().min(1, "Le client est obligatoire"),
  bon_livraison_id: z.string().optional().nullable(),
  depot_id: z.string().min(1, "Le dépôt est obligatoire"),
  motif: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  inclure_tva: z.boolean().default(false),
  lignes: z.array(documentLigneSchema).min(1, "Au moins une ligne est requise"),
  paiements: z.array(z.any()).optional().default([]),
})

export type BonRetourFormData = z.infer<typeof bonRetourSchema>

export const bonCommandeSchema = z.object({
  date: z.string().min(1, "La date est obligatoire"),
  fournisseur_id: z.string().min(1, "Le fournisseur est obligatoire"),
  notes: z.string().optional().nullable(),
  inclure_tva: z.boolean().default(false),
  lignes: z.array(documentLigneSchema).min(1, "Au moins une ligne est requise"),
})

export type BonCommandeFormData = z.infer<typeof bonCommandeSchema>

export const bonAchatSchema = z.object({
  date: z.string().min(1, "La date est obligatoire"),
  fournisseur_id: z.string().min(1, "Le fournisseur est obligatoire"),
  bon_commande_id: z.string().optional().nullable(),
  depot_id: z.string().min(1, "Le dépôt est obligatoire"),
  notes: z.string().optional().nullable(),
  inclure_tva: z.boolean().default(false),
  lignes: z.array(documentLigneSchema).min(1, "Au moins une ligne est requise"),
  paiements: z.array(z.any()).optional().default([]),
})

export type BonAchatFormData = z.infer<typeof bonAchatSchema>

export const bonRetourAchatSchema = z.object({
  date: z.string().min(1, "La date est obligatoire"),
  fournisseur_id: z.string().min(1, "Le fournisseur est obligatoire"),
  depot_id: z.string().min(1, "Le dépôt est obligatoire"),
  motif: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  inclure_tva: z.boolean().default(false),
  lignes: z.array(documentLigneSchema).min(1, "Au moins une ligne est requise"),
  paiements: z.array(z.any()).optional().default([]),
})

export type BonRetourAchatFormData = z.infer<typeof bonRetourAchatSchema>
