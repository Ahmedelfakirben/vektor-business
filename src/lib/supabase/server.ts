import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "@/types/database"

const DEFAULT_URL = "https://api-khalid.elfakir.com"
const DEFAULT_ANON_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc5MTc0NjM0MCwiZXhwIjo0OTQ3NDE5OTQwLCJyb2xlIjoiYW5vbiJ9.zTAuR28zgIjrnpt-IZDAa7i0G-tdgIspqwyAUHqBduY"

export async function createClient() {
  const cookieStore = await cookies()
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL
  if (url.startsWith("http://api-khalid.elfakir.com")) {
    url = url.replace("http://", "https://")
  }
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY

  return createServerClient<Database>(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  )
}
