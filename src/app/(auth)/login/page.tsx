"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createClient } from "@/lib/supabase/client"
import { loginSchema, type LoginFormData } from "@/lib/validations/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ShoppingBag } from "lucide-react"
import { InstallPWA } from "@/components/auth/install-pwa"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirectTo") || "/dashboard"
  const isPosRedirect = redirectTo === "/pos" || redirectTo.startsWith("/pos")

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginFormData) {
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })

    if (error) {
      console.error("Login auth error:", error)
      if (error.message?.includes("Invalid login credentials")) {
        setError("Identifiants incorrects. Veuillez vérifier l'email et le mot de passe.")
      } else {
        setError(error.message || "Erreur de connexion au serveur d'authentification.")
      }
      setLoading(false)
      return
    }

    router.push(redirectTo)
    router.refresh()
  }

  return (
    <Card className="w-full max-w-md shadow-2xl border-orange-500/20 bg-slate-900/90 backdrop-blur-xl text-slate-100">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto mb-5 flex flex-col items-center gap-3">
          <div className="h-32 w-32 overflow-hidden rounded-2xl shadow-[0_0_35px_rgba(249,115,22,0.3)] ring-2 ring-orange-500/40 bg-slate-950 p-1 transition-transform duration-300 hover:scale-105">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpeg" alt="Linventory Logo" className="h-full w-full object-cover rounded-xl" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 tracking-tight">
              Linventory
            </h1>
            <p className="text-[11px] tracking-widest uppercase font-semibold text-orange-400/80 mt-0.5">
              ERP &amp; Gestion Commerciale
            </p>
          </div>
          {isPosRedirect && (
            <Badge variant="outline" className="gap-1.5 px-3 py-1 text-xs border-orange-500/40 text-orange-400 bg-orange-500/10 font-bold">
              <ShoppingBag className="h-3.5 w-3.5" />
              Terminal Point de Vente (POS)
            </Badge>
          )}
        </div>
        <CardTitle className="text-xl text-slate-100">
          {isPosRedirect ? "Session Caisse POS" : "Connexion"}
        </CardTitle>
        <CardDescription className="text-slate-400">
          {isPosRedirect
            ? "Connectez-vous pour ouvrir votre session de caisse"
            : "Accédez à votre espace de gestion"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-200">Adresse e-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="votre@email.com"
              className="bg-slate-950/60 border-slate-800 text-slate-100 placeholder:text-slate-500 focus-visible:ring-orange-500"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-200">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              className="bg-slate-950/60 border-slate-800 text-slate-100 placeholder:text-slate-500 focus-visible:ring-orange-500"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <Button 
            type="submit" 
            className="w-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold shadow-lg shadow-orange-500/25 transition-all duration-200 py-2.5" 
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isPosRedirect ? "Accéder à la Caisse" : "Se connecter"}
          </Button>
        </form>

        <InstallPWA />
      </CardContent>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-orange-950/40 p-4">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
