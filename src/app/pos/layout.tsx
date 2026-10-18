import { Suspense } from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Point de Vente (POS) - Linventory",
  description: "Terminal Point de Vente spécialisé Linventory",
}

export default function PosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense fallback={null}>
      <div className="min-h-screen h-screen flex flex-col bg-background text-foreground overflow-hidden">
        {children}
      </div>
    </Suspense>
  )
}
