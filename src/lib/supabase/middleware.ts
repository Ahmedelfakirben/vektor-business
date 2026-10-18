import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

function getAbsoluteUrl(request: NextRequest, pathWithQuery: string): URL {
  const forwardedProto = request.headers.get("x-forwarded-proto")
  const proto = forwardedProto || (process.env.NODE_ENV === "production" ? "https" : request.nextUrl.protocol.replace(":", "")) || "https"
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || request.nextUrl.host
  return new URL(pathWithQuery, `${proto}://${host}`)
}

function redirectWithCookies(targetUrl: URL, supabaseResponse: NextResponse): NextResponse {
  const redirectRes = NextResponse.redirect(targetUrl)
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    redirectRes.cookies.set(cookie.name, cookie.value, cookie)
  })
  return redirectRes
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  let url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://api-khalid.elfakir.com"
  if (url.startsWith("http://api-khalid.elfakir.com")) {
    url = url.replace("http://", "https://")
  }
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc5MTc0NjM0MCwiZXhwIjo0OTQ3NDE5OTQwLCJyb2xlIjoiYW5vbiJ9.zTAuR28zgIjrnpt-IZDAa7i0G-tdgIspqwyAUHqBduY"

  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data?.user || null
  } catch (err) {
    console.warn("Middleware auth check failed:", err)
  }

  const pathname = request.nextUrl.pathname

  // Public routes and assets that don't require auth
  const publicRoutes = ["/login", "/forgot-password", "/manifest.webmanifest", "/manifest.json", "/favicon.ico", "/logo.jpeg", "/logo.png", "/icon-192.png", "/icon-512.png"]
  const isPublicRoute = publicRoutes.some((route) =>
    pathname === route || pathname.startsWith(route)
  )

  // 1. Not logged in -> redirect to login (unless already on public route or login)
  if (!user && !isPublicRoute) {
    if (pathname === "/login") {
      return supabaseResponse
    }
    const redirectTarget = pathname === "/" ? "/dashboard" : (pathname + request.nextUrl.search)
    const targetUrl = getAbsoluteUrl(request, `/login?redirectTo=${encodeURIComponent(redirectTarget)}`)
    return redirectWithCookies(targetUrl, supabaseResponse)
  }

  // 2. Already logged in and visiting login or forgot-password -> redirect to destination
  const isAuthPage = pathname === "/login" || pathname === "/forgot-password"
  if (user && isAuthPage) {
    const rawRedirect = request.nextUrl.searchParams.get("redirectTo") || "/dashboard"
    // Disallow redirecting back to /login or /
    const target = (!rawRedirect || rawRedirect === "/" || rawRedirect.startsWith("/login"))
      ? "/dashboard"
      : rawRedirect

    if (pathname === target) {
      return supabaseResponse
    }

    const targetUrl = getAbsoluteUrl(request, target)
    return redirectWithCookies(targetUrl, supabaseResponse)
  }

  // 3. RBAC: Role-based route protection
  if (user) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle()

      const role = profile?.role || "commercial"

      const roleRestrictions: Record<string, string[]> = {
        commercial: ["/settings", "/salaries"],
        magasinier: ["/settings", "/salaries", "/pos", "/vente/devis", "/achat/bon-commande"],
      }

      const restricted = roleRestrictions[role] || []
      const isRestricted = restricted.some((route) => pathname.startsWith(route))

      if (isRestricted && pathname !== "/dashboard") {
        const targetUrl = getAbsoluteUrl(request, "/dashboard")
        return redirectWithCookies(targetUrl, supabaseResponse)
      }
    } catch (e) {
      console.warn("Middleware profile check error:", e)
    }
  }

  return supabaseResponse
}
