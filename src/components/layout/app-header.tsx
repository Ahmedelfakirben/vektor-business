"use client"

import { Fragment } from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { usePathname } from "next/navigation"

const routeLabels: Record<string, string> = {
  dashboard: "Tableau de bord",
  clients: "Clients",
  fournisseurs: "Fournisseurs",
  articles: "Articles",
  familles: "Familles",
  depots: "Dépôts",
  salaries: "Salariés",
  tresoreries: "Trésoreries",
  vente: "Vente",
  devis: "Devis",
  commandes: "Commandes",
  factures: "Factures",
  avoirs: "Factures d'Avoir",
  bons_livraison: "Bons de Livraison",
  achats: "Achats",
  reglements: "Règlements",
  echeances: "Échéances",
  clotures: "Clôtures",
  users: "Utilisateurs",
  settings: "Paramètres",
  nouveau: "Nouveau",
  modifier: "Modifier",
}

export function AppHeader() {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            {segments.map((segment, index) => {
              const isLast = index === segments.length - 1
              const href = "/" + segments.slice(0, index + 1).join("/")
              const label = routeLabels[segment] || segment

              return (
                <Fragment key={href}>
                  {index > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage>
                        {label}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink href={href}>{label}</BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  )
}
