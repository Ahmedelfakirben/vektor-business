import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@/types/database"

const DEFAULT_URL = "https://api-khalid.elfakir.com"
const DEFAULT_ANON_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc5MTc0NjM0MCwiZXhwIjo0OTQ3NDE5OTQwLCJyb2xlIjoiYW5vbiJ9.zTAuR28zgIjrnpt-IZDAa7i0G-tdgIspqwyAUHqBduY"

export function createClient() {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY;
  if (url.startsWith("http://api-khalid.elfakir.com")) {
    url = url.replace("http://", "https://")
  }
  const schema = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public"
  return createBrowserClient<Database>(url, key, {
    db: { schema }
  })
}
