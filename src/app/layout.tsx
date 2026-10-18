import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "@/lib/providers"

export const metadata: Metadata = {
  title: "Vektor Business | ERP & Gestión Comercial",
  description: "Système de gestion commerciale, stocks et point de vente Linventory",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Vektor Business | ERP & Gestión Comercial",
  },
  icons: {
    icon: "/logo.jpeg",
    apple: "/logo.jpeg",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr">
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
