"use server"

import { createClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"

function getAdminAuthClient() {
  let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://api-khalid.elfakir.com"
  if (supabaseUrl.startsWith("http://api-khalid.elfakir.com")) {
    supabaseUrl = supabaseUrl.replace("http://", "https://")
  }
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc5MTc0NjM0MCwiZXhwIjo0OTQ3NDE5OTQwLCJyb2xlIjoiYW5vbiJ9.zTAuR28zgIjrnpt-IZDAa7i0G-tdgIspqwyAUHqBduY"

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function getAdminUsers() {
  try {
    const adminAuthClient = getAdminAuthClient()
    if (!adminAuthClient) {
      return { error: "Configuration Supabase manquante" }
    }

    // If service role key is available, list auth users directly
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const { data: { users }, error } = await adminAuthClient.auth.admin.listUsers()
        if (!error && users) {
          const { data: profiles } = await adminAuthClient.from("profiles").select("*")
          return users
            .map((user) => {
              const profile = profiles?.find((p) => p.user_id === user.id)
              return {
                id: user.id,
                email: user.email,
                nom: profile?.nom || "",
                prenom: profile?.prenom || "",
                role: profile?.role || "Inconnu",
                created_at: user.created_at,
              }
            })
            .filter((u) => u.role === "admin")
        }
      } catch (e) {
        console.warn("auth.admin.listUsers failed, falling back to profiles table query", e)
      }
    }

    // Fallback: Query profiles table directly
    const { data: profiles, error: profileError } = await adminAuthClient
      .from("profiles")
      .select("*")
      .eq("role", "admin")

    if (profileError) throw profileError

    return (profiles || []).map((profile) => ({
      id: profile.user_id || profile.id,
      email: profile.email,
      nom: profile.nom || "",
      prenom: profile.prenom || "",
      role: profile.role || "admin",
      created_at: profile.created_at,
    }))
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function createAdminUser(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const nom = formData.get("nom") as string
  const prenom = formData.get("prenom") as string

  if (!email || !password) return { error: "Email et mot de passe sont requis." }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      error:
        "La variable SUPABASE_SERVICE_ROLE_KEY est requise dans .env.local pour créer un administrateur depuis l'interface.",
    }
  }

  const adminAuthClient = getAdminAuthClient()
  if (!adminAuthClient) return { error: "Configuration Supabase manquante." }

  try {
    const { data, error } = await adminAuthClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (error) throw error

    await new Promise((r) => setTimeout(r, 500))

    const { error: profileError } = await adminAuthClient
      .from("profiles")
      .update({
        nom,
        prenom,
        role: "admin",
      })
      .eq("user_id", data.user.id)

    if (profileError) throw profileError

    revalidatePath("/settings")
    return { success: true }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function deleteAdminUser(userId: string) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      error:
        "La variable SUPABASE_SERVICE_ROLE_KEY est requise dans .env.local pour supprimer un utilisateur.",
    }
  }

  const adminAuthClient = getAdminAuthClient()
  if (!adminAuthClient) return { error: "Configuration Supabase manquante." }

  try {
    const { error } = await adminAuthClient.auth.admin.deleteUser(userId)
    if (error) throw error

    revalidatePath("/settings")
    return { success: true }
  } catch (error: any) {
    return { error: error.message }
  }
}
