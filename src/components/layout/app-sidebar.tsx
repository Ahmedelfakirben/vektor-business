"use client"

import { useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import {
  LayoutDashboard,
  Users,
  Truck,
  Package,
  FolderTree,
  Warehouse,
  UserCog,
  Landmark,
  FileText,
  ClipboardList,
  RotateCcw,
  ShoppingCart,
  ClipboardCheck,
  PackagePlus,
  PackageMinus,
  MonitorSmartphone,
  Boxes,
  Settings,
  LogOut,
  Wallet,
  Layers,
  ChevronDown,
  Receipt,
  ExternalLink,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

interface NavItem {
  title: string
  url: string
  icon: any
  target?: string
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const navigation: NavGroup[] = [
  {
    label: "Général",
    items: [
      { title: "Tableau de bord", url: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Opérations",
    items: [
      { title: "Point de vente", url: "/pos", icon: MonitorSmartphone, target: "_blank" },
      { title: "Historique POS", url: "/historique-pos", icon: Receipt },
      { title: "Stock", url: "/stock", icon: Boxes },
    ],
  },
  {
    label: "Vente",
    items: [
      { title: "Devis", url: "/devis", icon: FileText },
      { title: "Bon de livraison", url: "/bon-livraisons", icon: ClipboardList },
      { title: "Bon de retour", url: "/bon-retours", icon: RotateCcw },
    ],
  },
  {
    label: "Achat",
    items: [
      { title: "Bon de commande", url: "/bon-commandes", icon: ShoppingCart },
      { title: "Bon d'achat", url: "/bon-achats", icon: PackagePlus },
      { title: "Bon de retour", url: "/bon-retour-achats", icon: PackageMinus },
    ],
  },
  {
    label: "Finance",
    items: [
      { title: "État Général", url: "/finance/etat-general", icon: ClipboardList },
      { title: "État du Client", url: "/finance/creances", icon: Landmark },
      { title: "État du Fournisseur", url: "/finance/dettes", icon: ClipboardCheck },
      { title: "Portefeuille", url: "/finance/portefeuille", icon: Wallet },
    ],
  },
  {
    label: "Données Maîtres",
    items: [
      { title: "Clients", url: "/clients", icon: Users },
      { title: "Fournisseurs", url: "/fournisseurs", icon: Truck },
      { title: "Articles", url: "/articles", icon: Package },
      { title: "Familles", url: "/familles", icon: FolderTree },
      { title: "Sous-familles", url: "/sous-familles", icon: Layers },
      { title: "Dépôts", url: "/depots", icon: Warehouse },
      { title: "Dépenses", url: "/depenses", icon: Wallet },
      { title: "Salariés", url: "/salaries", icon: UserCog },
      { title: "Trésoreries", url: "/tresoreries", icon: Landmark },
    ],
  },
]

export function AppSidebar() {
  const { isMobile, setOpenMobile } = useSidebar()
  const pathname = usePathname()
  const router = useRouter()

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    "Général": false,
    "Opérations": false,
    "Vente": false,
    "Achat": false,
    "Finance": false,
    "Données Maîtres": false,
  })

  // Load persisted collapse state on client mount only if user previously interacted
  useEffect(() => {
    try {
      const saved = localStorage.getItem("khalid_sidebar_groups")
      if (saved) {
        setOpenGroups(JSON.parse(saved))
      }
    } catch {}
  }, [])

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => {
      const updated = { ...prev, [label]: !prev[label] }
      try {
        localStorage.setItem("khalid_sidebar_groups", JSON.stringify(updated))
      } catch {}
      return updated
    })
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/dashboard" className="flex items-center gap-3" onClick={handleLinkClick}>
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl shadow-md ring-1 ring-orange-500/30 bg-slate-950">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpeg" alt="Linventory" className="h-full w-full object-cover" />
          </div>
          <div>
            <h1 className="text-lg font-black text-orange-500 tracking-tight leading-tight">
              Linventory
            </h1>
            <p className="text-xs text-muted-foreground">ERP & Gestion Commerciale</p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {navigation.map((group) => {
          const isOpen = Boolean(openGroups[group.label])
          const hasActiveItem = group.items.some(
            item => pathname === item.url || pathname.startsWith(item.url + "/")
          )

          return (
            <SidebarGroup key={group.label} className="py-1">
              <SidebarGroupLabel asChild>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  className="flex w-full items-center justify-between cursor-pointer rounded-md px-2 py-1.5 text-xs font-semibold text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors select-none group/header"
                >
                  <span className={cn(hasActiveItem && "text-primary font-bold")}>
                    {group.label}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform duration-200 text-sidebar-foreground/50 group-hover/header:text-sidebar-foreground",
                      !isOpen && "-rotate-90"
                    )}
                  />
                </button>
              </SidebarGroupLabel>

              {isOpen && (
                <SidebarGroupContent className="animate-in fade-in-50 duration-150">
                  <SidebarMenu>
                    {group.items.map((item) => (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton
                          asChild
                          isActive={pathname === item.url || (item.target !== "_blank" && pathname.startsWith(item.url + "/"))}
                          onClick={item.target === "_blank" ? undefined : handleLinkClick}
                        >
                          <Link
                            href={item.url}
                            target={item.target}
                            rel={item.target === "_blank" ? "noopener noreferrer" : undefined}
                          >
                            <item.icon className="h-4 w-4" />
                            <span className="flex-1">{item.title}</span>
                            {item.target === "_blank" && (
                              <ExternalLink className="h-3 w-3 text-muted-foreground/60 ml-auto shrink-0" />
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              )}
            </SidebarGroup>
          )
        })}
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname.startsWith("/settings")}
              onClick={handleLinkClick}
            >
              <Link href="/settings">
                <Settings className="h-4 w-4" />
                <span>Paramètres</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              <span>Déconnexion</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
