import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@/types/database"

const DEFAULT_URL = "https://linventor.178.104.92.15.sslip.io"
const DEFAULT_ANON_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc5MjMzMjMwMCwiZXhwIjo0OTQ4MDA1OTAwLCJyb2xlIjoiYW5vbiJ9.CDXG4CUj5i3nba2-8R59s_BgNzw7lTGvqgh9zYlY2bc"

const fallbackSchema = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "vektor_business";

export function getActiveSchema(): string {
  if (typeof window !== "undefined") {
    const explicit = localStorage.getItem("vektor_active_schema");
    if (explicit) return explicit;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
        try {
          const parsed = JSON.parse(localStorage.getItem(key) || "{}");
          if (parsed?.user?.user_metadata?.schema) {
            return parsed.user.user_metadata.schema;
          }
        } catch (_) {}
      }
    }
  }
  return fallbackSchema;
}

export function createClient() {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY;
  if (url.startsWith("http://api-khalid.elfakir.com")) {
    url = url.replace("http://", "https://");
  }

  const baseClient = createBrowserClient<Database>(url, key, {
    db: { schema: fallbackSchema as any }
  });

  if (typeof window !== "undefined") {
    baseClient.auth.onAuthStateChange((event, session) => {
      if (session?.user?.user_metadata?.schema) {
        localStorage.setItem("vektor_active_schema", session.user.user_metadata.schema);
      } else if (event === "SIGNED_OUT") {
        localStorage.removeItem("vektor_active_schema");
      }
    });
  }

  return new Proxy(baseClient, {
    get(target, prop, receiver) {
      const activeSchema = getActiveSchema();
      if (activeSchema && activeSchema !== fallbackSchema) {
        if (prop === "from") {
          return (relation: string) => target.schema(activeSchema as any).from(relation as any);
        }
        if (prop === "rpc") {
          return (fn: string, args: any) => target.schema(activeSchema as any).rpc(fn as any, args);
        }
      }
      return Reflect.get(target, prop, receiver);
    }
  }) as typeof baseClient;
}
