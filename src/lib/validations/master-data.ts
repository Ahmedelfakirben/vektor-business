import { z } from "zod"

export const clientSchema = z.object({
  code: z.string().optional().nullable(),
  raison_sociale: z.string().min(1, "La raison sociale est obligatoire"),
  adresse: z.string().optional().nullable(),
  ville: z.string().optional().nullable(),
  telephone: z.string().optional().nullable(),
  email: z.string().email("E-mail invalide").optional().nullable().or(z.literal("")),
  ice: z.string().optional().nullable(),
})

export type ClientFormData = z.infer<typeof clientSchema>

export const fournisseurSchema = z.object({
  code: z.string().optional().nullable(),
  raison_sociale: z.string().min(1, "La raison sociale est obligatoire"),
  adresse: z.string().optional().nullable(),
  ville: z.string().optional().nullable(),
  telephone: z.string().optional().nullable(),
  email: z.string().email("E-mail invalide").optional().nullable().or(z.literal("")),
  ice: z.string().optional().nullable(),
})

export type FournisseurFormData = z.infer<typeof fournisseurSchema>

export const familleArticleSchema = z.object({
  code: z.string().optional().nullable(),
  libelle: z.string().min(1, "Le libellé est obligatoire"),
  description: z.string().optional().nullable(),
})

export type FamilleArticleFormData = z.infer<typeof familleArticleSchema>

export const sousFamilleArticleSchema = z.object({
  famille_id: z.string().min(1, "La famille est obligatoire"),
  libelle: z.string().min(1, "Le libellé est obligatoire"),
  description: z.string().optional().nullable(),
  type_code_requis: z.string().optional().nullable(),
})

export type SousFamilleArticleFormData = z.infer<typeof sousFamilleArticleSchema>

export const articleSchema = z.object({
  code: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
  code_barre: z.string().optional().nullable(),
  designation: z.string().min(1, "La désignation est obligatoire"),
  famille_id: z.string().optional().nullable(),
  sous_famille_id: z.string().optional().nullable(),
  prix_achat: z.coerce.number().min(0, "Le prix d'achat doit être positif"),
  prix_vente: z.coerce.number().min(0, "Le prix de vente doit être positif"),
  tva: z.coerce.number().min(0).max(100).default(0),
  image_url: z.string().optional().nullable().or(z.literal("")),
  unite: z.string().min(1, "L'unité est obligatoire"),
  seuil_alerte: z.coerce.number().int().min(0, "Le seuil doit être positif"),
  actif: z.boolean().default(true),
  // Stock Initial (Optionnel, à la création)
  stock_initial: z.coerce.number().min(0).optional(),
  depot_id: z.string().optional(),
})

export type ArticleFormData = z.infer<typeof articleSchema>

export const depotSchema = z.object({
  code: z.string().optional().nullable(),
  libelle: z.string().min(1, "Le libellé est obligatoire"),
  adresse: z.string().optional().nullable(),
  responsable_id: z.string().optional().nullable(),
})

export type DepotFormData = z.infer<typeof depotSchema>

export const salarieSchema = z.object({
  matricule: z.string().optional().nullable(),
  nom: z.string().min(1, "Le nom est obligatoire"),
  prenom: z.string().min(1, "Le prénom est obligatoire"),
  poste: z.string().optional().nullable(),
  telephone: z.string().optional().nullable(),
  email: z.string().email("E-mail invalide").optional().nullable().or(z.literal("")),
  date_embauche: z.string().optional().nullable(),
  salaire: z.coerce.number().min(0).optional().nullable(),
  actif: z.boolean().default(true),
})

export type SalarieFormData = z.infer<typeof salarieSchema>

export const tresorerieSchema = z.object({
  code: z.string().optional().nullable(),
  libelle: z.string().min(1, "Le libellé est obligatoire"),
  type: z.enum(["caisse", "banque"]),
  solde: z.coerce.number().default(0),
})

export type TresorerieFormData = z.infer<typeof tresorerieSchema>
