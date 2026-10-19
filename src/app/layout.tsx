import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "@/lib/providers"

export const metadata: Metadata = {
  title: "Vektor Business | ERP & Gestión Comercial",
  description: "Suite integral de gestión comercial, finanzas multi-empresa y control de inventario",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Vektor Business | ERP & Gestión Comercial",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon.png", sizes: "64x64", type: "image/png" },
    ],
    apple: "/icon-192.png",
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
