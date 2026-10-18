import { z } from "zod"

export const loginSchema = z.object({
  email: z.string().email("Adresse e-mail invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
})

export type LoginFormData = z.infer<typeof loginSchema>

export const forgotPasswordSchema = z.object({
  email: z.string().email("Adresse e-mail invalide"),
})

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>
