"use client"

import { useState, useMemo } from "react"
import { useVentePosList, useDeleteVentePos } from "@/hooks/use-ventes-pos"
import type { VentePos } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LoadingScreen } from "@/components/ui/loading-screen"
import { useExportToExcel } from "@/hooks/use-export-excel"
import {
  Search,
  MoreHorizontal,
  Trash2,
  Eye,
  Printer,
  FileSpreadsheet,
  ExternalLink,
  ReceiptText,
  ShoppingBag,
  Banknote,
  CreditCard,
  Calendar,
  Layers,
  User,
  CheckCircle2,
  FileCheck2,
  ArrowUpRight,
  ShieldCheck,
  Scale,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { printPosTicket, printPosCloture } from "@/lib/pos-printer"
import { useCompanySettings } from "@/hooks/use-company-settings"

const modeLabels: Record<string, string> = {
  especes: "Espèces",
  carte: "Carte Bancaire",
  cheque: "Chèque",
  virement: "Virement",
}

export default function HistoriquePosPage() {
  const { data: ventes, isLoading } = useVentePosList()
  const deleteVente = useDeleteVentePos()
  const { exportToExcel, isExporting } = useExportToExcel()
  const { company: companySettings } = useCompanySettings()

  const todayStr = new Date().toISOString().split("T")[0]
  const currentMonthStr = todayStr.substring(0, 7) // YYYY-MM
  const currentYearStr = todayStr.substring(0, 4) // YYYY

  // Filters State
  const [search, setSearch] = useState("")
  const [dateType, setDateType] = useState<"day" | "month" | "year" | "all">("day")
  const [selectedDay, setSelectedDay] = useState(todayStr)
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr)
  const [selectedYear, setSelectedYear] = useState(currentYearStr)
  const [selectedUser, setSelectedUser] = useState<string>("all")
  const [paymentFilter, setPaymentFilter] = useState<string>("all")

  // Modals
  const [selectedVente, setSelectedVente] = useState<VentePos | null>(null)
  const [clotureModalOpen, setClotureModalOpen] = useState(false)

  // Unique Users List from Ventes
  const uniqueUsers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; email?: string }>()
    ventes?.forEach((v) => {
      if (v.commercial_id) {
        const name =
          [v.commercial?.prenom, v.commercial?.nom].filter(Boolean).join(" ") ||
          v.commercial?.email ||
          "Utilisateur"
        map.set(v.commercial_id, { id: v.commercial_id, name, email: v.commercial?.email })
      }
    })
    return Array.from(map.values())
  }, [ventes])

  // Years list for year filter
  const availableYears = useMemo(() => {
    const years = new Set<string>()
    years.add(currentYearStr)
    ventes?.forEach((v) => {
      const y = (v.date || v.created_at || "").substring(0, 4)
      if (y && y.length === 4) years.add(y)
    })
    return Array.from(years).sort().reverse()
  }, [ventes, currentYearStr])

  // Filtered Ventes
  const filteredVentes = useMemo(() => {
    return (
      ventes?.filter((v) => {
        // Search filter
        const matchesSearch =
          v.numero.toLowerCase().includes(search.toLowerCase()) ||
          (v.client?.raison_sociale && v.client.raison_sociale.toLowerCase().includes(search.toLowerCase())) ||
          (v.tresorerie?.libelle && v.tresorerie.libelle.toLowerCase().includes(search.toLowerCase()))

        if (!matchesSearch) return false

        // User filter
        if (selectedUser !== "all" && v.commercial_id !== selectedUser) {
          return false
        }

        // Payment filter
        if (paymentFilter !== "all" && v.mode_paiement !== paymentFilter) {
          return false
        }

        // Date filter
        const vDate = v.date || (v.created_at ? v.created_at.split("T")[0] : "")
        if (dateType === "day") {
          return vDate === selectedDay
        }
        if (dateType === "month") {
          return vDate.startsWith(selectedMonth)
        }
        if (dateType === "year") {
          return vDate.startsWith(selectedYear)
        }

        return true
      }) || []
    )
  }, [ventes, search, selectedUser, paymentFilter, dateType, selectedDay, selectedMonth, selectedYear])

  // KPIs
  const kpis = useMemo(() => {
    const total = filteredVentes.reduce((acc, v) => acc + Number(v.montant_ttc || 0), 0)
    const totalEspeces = filteredVentes
      .filter((v) => v.mode_paiement === "especes")
      .reduce((acc, v) => acc + Number(v.montant_ttc || 0), 0)
    const totalCarte = filteredVentes
      .filter((v) => v.mode_paiement === "carte")
      .reduce((acc, v) => acc + Number(v.montant_ttc || 0), 0)
    const totalCheque = filteredVentes
      .filter((v) => v.mode_paiement === "cheque")
      .reduce((acc, v) => acc + Number(v.montant_ttc || 0), 0)
    const totalVirement = filteredVentes
      .filter((v) => v.mode_paiement === "virement")
      .reduce((acc, v) => acc + Number(v.montant_ttc || 0), 0)

    const count = filteredVentes.length
    const countEspeces = filteredVentes.filter((v) => v.mode_paiement === "especes").length
    const countCarte = filteredVentes.filter((v) => v.mode_paiement === "carte").length
    const countCheque = filteredVentes.filter((v) => v.mode_paiement === "cheque").length
    const countVirement = filteredVentes.filter((v) => v.mode_paiement === "virement").length

    return {
      total,
      totalEspeces,
      totalCarte,
      totalCheque,
      totalVirement,
      count,
      countEspeces,
      countCarte,
      countCheque,
      countVirement,
    }
  }, [filteredVentes])

  // Detailed articles breakdown for Clôture de Caisse
  const clotureArticlesData = useMemo(() => {
    const userMap: Record<
      string,
      {
        userName: string
        totalArticles: number
        totalMontant: number
        articlesMap: Record<string, { designation: string; quantite: number; total: number }>
      }
    > = {}
    const summaryMap: Record<string, { designation: string; quantite: number; total: number; vendeurs: Set<string> }> = {}

    filteredVentes?.forEach((v) => {
      const sellerName =
        [v.commercial?.prenom, v.commercial?.nom].filter(Boolean).join(" ") ||
        v.commercial?.email?.split("@")[0] ||
        "Caissier Standard"

      const userId = v.commercial_id || "default"
      if (!userMap[userId]) {
        userMap[userId] = {
          userName: sellerName,
          totalArticles: 0,
          totalMontant: 0,
          articlesMap: {},
        }
      }

      v.lignes?.forEach((ligne: any) => {
        const qty = Number(ligne.quantite) || 0
        const pu = Number(ligne.prix_unitaire) || 0
        const total = Number(ligne.montant_ht) || qty * pu
        const desig = ligne.designation || "Article"

        // User breakdown
        userMap[userId].totalArticles += qty
        userMap[userId].totalMontant += total
        if (!userMap[userId].articlesMap[desig]) {
          userMap[userId].articlesMap[desig] = { designation: desig, quantite: 0, total: 0 }
        }
        userMap[userId].articlesMap[desig].quantite += qty
        userMap[userId].articlesMap[desig].total += total

        // Global summary
        if (!summaryMap[desig]) {
          summaryMap[desig] = { designation: desig, quantite: 0, total: 0, vendeurs: new Set() }
        }
        summaryMap[desig].quantite += qty
        summaryMap[desig].total += total
        summaryMap[desig].vendeurs.add(sellerName)
      })
    })

    const articlesGroupedByUser = Object.values(userMap).map((u) => ({
      userName: u.userName,
      totalArticles: u.totalArticles,
      totalMontant: u.totalMontant,
      articles: Object.values(u.articlesMap),
    }))

    const articlesSummary = Object.values(summaryMap).map((s) => ({
      designation: s.designation,
      quantite: s.quantite,
      total: s.total,
      vendeur: Array.from(s.vendeurs).join(", "),
    }))

    return {
      articlesGroupedByUser,
      articlesSummary,
    }
  }, [filteredVentes])

  // Active cashier name for Clôture
  const activeCashierName = useMemo(() => {
    if (selectedUser === "all") {
      return "Tous les caissiers (Ensemble)"
    }
    const u = uniqueUsers.find((user) => user.id === selectedUser)
    return u ? u.name : "Caissier"
  }, [selectedUser, uniqueUsers])

  // Active period label
  const activePeriodLabel = useMemo(() => {
    if (dateType === "day") {
      return new Date(selectedDay).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    }
    if (dateType === "month") {
      const [y, m] = selectedMonth.split("-")
      const d = new Date(parseInt(y), parseInt(m) - 1, 1)
      return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    }
    if (dateType === "year") {
      return `Année ${selectedYear}`
    }
    return "Toutes les dates"
  }, [dateType, selectedDay, selectedMonth, selectedYear])

  // Delete
  const handleDelete = async (id: string) => {
    try {
      await deleteVente.mutateAsync(id)
      toast.success("Vente supprimée avec succès")
    } catch {
      toast.error("Erreur lors de la suppression de la vente")
    }
  }

  // Export
  const handleExport = () => {
    exportToExcel(
      "ventes_pos",
      `Export_Ventes_POS_${new Date().toLocaleDateString("fr-FR").replace(/\//g, "-")}`,
      filteredVentes
    )
  }

  if (isLoading) return <LoadingScreen />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Historique des Ventes POS</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Filtrage par jour, mois, année, caissier et impression de tickets de clôture de caisse
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => setClotureModalOpen(true)}
            className="rounded-xl gap-2 font-bold text-xs border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 shadow-xs"
          >
            <Printer className="h-4 w-4" />
            <span>Ticket Clôture de Caisse</span>
          </Button>

          <Button
            variant="outline"
            onClick={handleExport}
            disabled={isExporting || filteredVentes.length === 0}
            className="rounded-xl gap-2 font-semibold text-xs"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            {isExporting ? "Exportation..." : "Exporter Excel"}
          </Button>

          <Button asChild className="rounded-xl gap-2 font-bold text-xs bg-orange-600 hover:bg-orange-700 text-white">
            <Link href="/pos" target="_blank">
              <ShoppingBag className="h-4 w-4" />
              <span>Ouvrir le POS</span>
              <ExternalLink className="h-3 w-3 opacity-70" />
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl p-4 bg-card border-border/70 shadow-xs">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Total Encaissé</span>
          <p className="text-2xl font-black text-foreground mt-1">
            {kpis.total.toFixed(2)} <span className="text-xs font-semibold text-muted-foreground">MAD</span>
          </p>
          <span className="text-xs text-muted-foreground mt-1 block">{kpis.count} tickets pour ce filtre</span>
        </Card>

        <Card className="rounded-2xl p-4 bg-card border-border/70 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Espèces</span>
            <Banknote className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {kpis.totalEspeces.toFixed(2)} <span className="text-xs font-semibold text-muted-foreground">MAD</span>
          </p>
          <span className="text-xs text-muted-foreground mt-1 block">
            {kpis.countEspeces} ventes en espèces
          </span>
        </Card>

        <Card className="rounded-2xl p-4 bg-card border-border/70 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Carte Bancaire</span>
            <CreditCard className="h-4 w-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
            {kpis.totalCarte.toFixed(2)} <span className="text-xs font-semibold text-muted-foreground">MAD</span>
          </p>
          <span className="text-xs text-muted-foreground mt-1 block">
            {kpis.countCarte} ventes par carte
          </span>
        </Card>

        <Card className="rounded-2xl p-4 bg-card border-border/70 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Chèques & Virements</span>
            <FileCheck2 className="h-4 w-4 text-purple-600" />
          </div>
          <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
            {(kpis.totalCheque + kpis.totalVirement).toFixed(2)} <span className="text-xs font-semibold text-muted-foreground">MAD</span>
          </p>
          <span className="text-xs text-muted-foreground mt-1 block">
            {kpis.countCheque + kpis.countVirement} règlements
          </span>
        </Card>
      </div>

      {/* Advanced Filter Bar: Jour / Mois / Année + Utilisateur */}
      <Card className="p-4 rounded-2xl border-border/70 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par N° ticket, client, caisse..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 rounded-xl text-xs bg-background"
            />
          </div>

          {/* Granular Date Filters (Jour / Mois / Année / Tout) */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-muted/60 p-1 rounded-xl border shrink-0">
              {[
                { id: "day", label: "Jour" },
                { id: "month", label: "Mois" },
                { id: "year", label: "Année" },
                { id: "all", label: "Tout" },
              ].map((dt) => (
                <button
                  key={dt.id}
                  type="button"
                  onClick={() => setDateType(dt.id as any)}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    dateType === dt.id
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {dt.label}
                </button>
              ))}
            </div>

            {/* Dynamic Date Pickers depending on dateType */}
            {dateType === "day" && (
              <Input
                type="date"
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="h-9 w-[150px] text-xs font-medium rounded-xl bg-background"
              />
            )}

            {dateType === "month" && (
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="h-9 w-[150px] text-xs font-medium rounded-xl bg-background"
              />
            )}

            {dateType === "year" && (
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="h-9 w-[110px] text-xs font-medium rounded-xl bg-background">
                  <SelectValue placeholder="Année" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((y) => (
                    <SelectItem key={y} value={y} className="text-xs">
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* User / Cashier Filter */}
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="h-9 w-[180px] text-xs font-semibold rounded-xl bg-background">
                <User className="h-3.5 w-3.5 mr-1 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Caissier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs font-bold">
                  Tous les caissiers
                </SelectItem>
                {uniqueUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id} className="text-xs">
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Payment Filter */}
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="h-9 w-[130px] text-xs rounded-xl bg-background">
                <SelectValue placeholder="Paiement" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Tous paiements</SelectItem>
                <SelectItem value="especes" className="text-xs">Espèces</SelectItem>
                <SelectItem value="carte" className="text-xs">Carte</SelectItem>
                <SelectItem value="cheque" className="text-xs">Chèque</SelectItem>
                <SelectItem value="virement" className="text-xs">Virement</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Current Active Filter Indicator */}
        <div className="flex items-center gap-2 pt-2 border-t border-border/40 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Filtre actif :</span>
          <Badge variant="outline" className="text-[11px] bg-muted/30">
            {activePeriodLabel}
          </Badge>
          <span>•</span>
          <Badge variant="outline" className="text-[11px] bg-muted/30">
            Caissier : {activeCashierName}
          </Badge>
          <span>•</span>
          <span className="font-bold text-foreground">{filteredVentes.length} tickets</span>
        </div>
      </Card>

      {/* Ventes Table */}
      <Card className="rounded-2xl border-border/70 shadow-xs overflow-hidden">
        <CardContent className="p-0">
          {filteredVentes.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <ReceiptText className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="font-semibold text-sm">Aucune vente trouvée</p>
              <p className="text-xs mt-1">Modifiez vos filtres de date ou d&apos;utilisateur.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 border-b text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-3 px-4 text-left">N° Vente</th>
                    <th className="py-3 px-4 text-left">Date & Heure</th>
                    <th className="py-3 px-4 text-left">Caissier / Vendeur</th>
                    <th className="py-3 px-4 text-left">Client</th>
                    <th className="py-3 px-4 text-left">Caisse</th>
                    <th className="py-3 px-4 text-left">Règlement</th>
                    <th className="py-3 px-4 text-right">Montant TTC</th>
                    <th className="py-3 px-4 text-right w-16">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredVentes.map((v) => {
                    const userName =
                      [v.commercial?.prenom, v.commercial?.nom].filter(Boolean).join(" ") ||
                      v.commercial?.email ||
                      "—"

                    return (
                      <tr
                        key={v.id}
                        onClick={() => setSelectedVente(v)}
                        className="hover:bg-muted/30 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-4 font-bold text-foreground">{v.numero}</td>
                        <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                          {new Date(v.date).toLocaleDateString("fr-FR")}
                          {v.created_at && (
                            <span className="text-[10px] ml-1.5 opacity-70">
                              {new Date(v.created_at).toLocaleTimeString("fr-FR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">
                              <User className="h-3 w-3" />
                            </div>
                            <span className="font-semibold text-foreground truncate max-w-[140px]" title={userName}>
                              {userName}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-medium">{v.client?.raison_sociale || "Comptoir"}</td>
                        <td className="py-3 px-4 text-muted-foreground">{v.tresorerie?.libelle || "—"}</td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="text-[10px] font-semibold">
                            {modeLabels[v.mode_paiement] || v.mode_paiement}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right font-black text-sm text-foreground whitespace-nowrap">
                          {Number(v.montant_ttc).toFixed(2)} MAD
                        </td>
                        <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl">
                              <DropdownMenuItem onClick={() => setSelectedVente(v)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Voir le ticket
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/historique-pos/${v.id}`}>
                                  <Layers className="mr-2 h-4 w-4" />
                                  Fiche détaillée
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem
                                    onSelect={(e) => e.preventDefault()}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Supprimer
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="rounded-2xl">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Supprimer définitivement la vente {v.numero} d&apos;un montant de{" "}
                                      {Number(v.montant_ttc).toFixed(2)} MAD ?
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="rounded-xl">Annuler</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDelete(v.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
                                    >
                                      Supprimer
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===================================================================== */}
      {/* 1. TICKET DETAIL MODAL */}
      {/* ===================================================================== */}
      <Dialog open={!!selectedVente} onOpenChange={() => setSelectedVente(null)}>
        <DialogContent className="max-w-md p-6 rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-black text-xl text-center">Ticket de Caisse POS</DialogTitle>
            <DialogDescription className="text-center text-xs">
              Vente N° {selectedVente?.numero}
            </DialogDescription>
          </DialogHeader>

          {selectedVente && (
            <div className="space-y-4 pt-2 font-mono text-xs">
              <div className="border border-dashed p-4 rounded-2xl bg-muted/20 space-y-3">
                <div className="text-center border-b border-dashed pb-3 font-sans">
                  <h4 className="font-black text-base tracking-wide uppercase">{companySettings?.nom || "LINVENTORY"}</h4>
                  {companySettings?.adresse && <p className="text-[10px] text-muted-foreground">{companySettings.adresse}</p>}
                  {companySettings?.telephone && <p className="text-[10px] text-muted-foreground">Tél: {companySettings.telephone}</p>}
                  {companySettings?.ice && <p className="text-[10px] text-muted-foreground">ICE: {companySettings.ice}</p>}
                  <p className="text-[11px] font-bold text-foreground mt-1">Ticket : {selectedVente.numero}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(selectedVente.date).toLocaleDateString("fr-FR")}
                    {selectedVente.created_at &&
                      ` à ${new Date(selectedVente.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}
                  </p>
                </div>

                <div className="flex justify-between text-[11px]">
                  <span>Caissier :</span>
                  <span className="font-bold">
                    {[selectedVente.commercial?.prenom, selectedVente.commercial?.nom].filter(Boolean).join(" ") ||
                      selectedVente.commercial?.email ||
                      "—"}
                  </span>
                </div>

                <div className="flex justify-between text-[11px]">
                  <span>Client : {selectedVente.client?.raison_sociale || "Comptoir"}</span>
                  <span>Règlement : {modeLabels[selectedVente.mode_paiement] || selectedVente.mode_paiement}</span>
                </div>

                <div className="flex justify-between text-[11px]">
                  <span>Caisse : {selectedVente.tresorerie?.libelle || "Caisse Principale"}</span>
                  <span>Dépôt : {selectedVente.depot?.libelle || "Dépôt Principal"}</span>
                </div>

                {/* Desglose de artículos del pedido */}
                <div className="py-2 border-t border-b border-dashed space-y-1.5">
                  <div className="flex justify-between font-bold text-[10px] uppercase text-muted-foreground pb-1 border-b border-dashed">
                    <span>Article</span>
                    <div className="flex gap-4">
                      <span>Qté x P.U</span>
                      <span className="w-16 text-right">Total</span>
                    </div>
                  </div>
                  {selectedVente.lignes && selectedVente.lignes.length > 0 ? (
                    selectedVente.lignes.map((item: any, idx: number) => {
                      const qty = Number(item.quantite) || 1
                      const pu = Number(item.prix_unitaire) || 0
                      const total = Number(item.montant_ht) || qty * pu
                      return (
                        <div key={idx} className="flex justify-between items-baseline text-[11px]">
                          <div className="truncate max-w-[160px]">
                            <span className="font-semibold">{item.designation || "Article"}</span>
                          </div>
                          <div className="flex gap-3 text-right">
                            <span className="text-muted-foreground">{qty} x {pu.toFixed(2)}</span>
                            <span className="font-bold w-16">{total.toFixed(2)} MAD</span>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="text-[11px] text-muted-foreground italic text-center py-1">
                      Détail des articles indisponible
                    </div>
                  )}
                </div>

                <div className="flex justify-between text-base font-black pt-2 border-t border-dashed">
                  <span>TOTAL TTC</span>
                  <span>{Number(selectedVente.montant_ttc).toFixed(2)} MAD</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl gap-2 text-xs"
                  onClick={() => {
                    const cashierName =
                      [selectedVente.commercial?.prenom, selectedVente.commercial?.nom].filter(Boolean).join(" ") ||
                      selectedVente.commercial?.email?.split("@")[0] ||
                      "Caissier"

                    printPosTicket({
                      numero: selectedVente.numero,
                      date: selectedVente.date,
                      heure: selectedVente.created_at
                        ? new Date(selectedVente.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
                        : undefined,
                      caissier: cashierName,
                      client: selectedVente.client?.raison_sociale || "Client Comptoir",
                      modePaiement: modeLabels[selectedVente.mode_paiement] || selectedVente.mode_paiement || "Espèces",
                      lignes: (selectedVente.lignes || []).map((l: any) => ({
                        designation: l.designation || "Article",
                        quantite: Number(l.quantite) || 1,
                        prix_unitaire: Number(l.prix_unitaire) || 0,
                        montant_total: Number(l.montant_ht) || (Number(l.quantite) || 1) * (Number(l.prix_unitaire) || 0),
                      })),
                      totalTTC: Number(selectedVente.montant_ttc) || 0,
                      montantRecu: Number(selectedVente.montant_recu) || undefined,
                      monnaieRendue: Number(selectedVente.monnaie_rendue) || undefined,
                    })
                  }}
                >
                  <Printer className="h-4 w-4" />
                  Imprimer Ticket
                </Button>
                <Button asChild className="flex-1 rounded-xl text-xs font-bold">
                  <Link href={`/historique-pos/${selectedVente.id}`}>Détail Articles</Link>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===================================================================== */}
      {/* 2. TICKET DE CLÔTURE DE CAISSE (ARQUEO / CIERRE DE CUENTAS) */}
      {/* ===================================================================== */}
      <Dialog open={clotureModalOpen} onOpenChange={setClotureModalOpen}>
        <DialogContent className="max-w-lg p-6 rounded-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-black text-xl text-center flex items-center justify-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <span>Bilan & Clôture de Caisse</span>
            </DialogTitle>
            <DialogDescription className="text-center text-xs">
              Récapitulatif pour la fermeture des comptes du caissier et des articles vendus
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2 font-mono text-xs">
            {/* Printable Thermal Receipt Style */}
            <div className="border border-dashed p-4 rounded-2xl bg-muted/20 space-y-3 print:border-none print:p-0">
              <div className="text-center border-b border-dashed pb-3 font-sans">
                <h3 className="font-black text-base tracking-tight uppercase">{companySettings?.nom || "LINVENTORY"} POS</h3>
                <p className="text-[11px] font-bold text-muted-foreground uppercase mt-0.5">
                  TICKET DE CLÔTURE / FERMETURE DE COMPTES
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Imprimé le {new Date().toLocaleDateString("fr-FR")} à {new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>

              {/* Caissier & Date */}
              <div className="space-y-1 text-[11px] pb-2 border-b border-dashed">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Caissier / Responsable :</span>
                  <span className="font-bold text-foreground">{activeCashierName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Période / Date :</span>
                  <span className="font-bold text-foreground">{activePeriodLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nombre de Ventes :</span>
                  <span className="font-black text-foreground">{kpis.count} tickets</span>
                </div>
              </div>

              {/* 1. Desglose de Pagos */}
              <div className="space-y-1.5 py-2 border-b border-dashed">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  1. Détail par Mode de Règlement
                </span>
                <div className="flex justify-between items-center text-xs">
                  <span>💵 Espèces en Caisse ({kpis.countEspeces})</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {kpis.totalEspeces.toFixed(2)} MAD
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span>💳 Carte Bancaire TPE ({kpis.countCarte})</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {kpis.totalCarte.toFixed(2)} MAD
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span>📝 Chèques ({kpis.countCheque})</span>
                  <span className="font-bold">
                    {kpis.totalCheque.toFixed(2)} MAD
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span>🏦 Virements ({kpis.countVirement})</span>
                  <span className="font-bold">
                    {kpis.totalVirement.toFixed(2)} MAD
                  </span>
                </div>
              </div>

              {/* 2. Ventes par Vendeur (Utilisateur) */}
              <div className="space-y-2 py-2 border-b border-dashed">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  2. Ventes par Vendeur (Utilisateur)
                </span>
                {clotureArticlesData.articlesGroupedByUser.length > 0 ? (
                  clotureArticlesData.articlesGroupedByUser.map((user, uIdx) => (
                    <div key={uIdx} className="bg-background/80 p-2.5 rounded-xl border border-dashed space-y-1.5">
                      <div className="flex justify-between items-center font-bold text-[11px] text-primary border-b border-dashed pb-1">
                        <span>👤 {user.userName}</span>
                        <span>{user.totalMontant.toFixed(2)} MAD ({user.totalArticles} art.)</span>
                      </div>
                      <div className="space-y-1 pl-1 text-[10px]">
                        {user.articles.map((art, aIdx) => (
                          <div key={aIdx} className="flex justify-between items-baseline">
                            <span className="truncate max-w-[200px] text-muted-foreground">• {art.designation}</span>
                            <span className="font-medium">{art.quantite} u. = {art.total.toFixed(2)} MAD</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] text-muted-foreground italic">Aucun article enregistré</p>
                )}
              </div>

              {/* 3. Récapitulatif Global des Articles Vendus */}
              <div className="space-y-1.5 py-2 border-b border-dashed">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  3. Récapitulatif Global des Articles ({clotureArticlesData.articlesSummary.length})
                </span>
                <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                  {clotureArticlesData.articlesSummary.length > 0 ? (
                    clotureArticlesData.articlesSummary.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-baseline text-[10px] py-0.5 border-b border-muted/30">
                        <div className="truncate max-w-[200px]">
                          <span className="font-semibold">{item.designation}</span>
                          <span className="text-[9px] text-muted-foreground block">Vendu par: {item.vendeur}</span>
                        </div>
                        <span className="font-bold text-right shrink-0">
                          {item.quantite} u. | {item.total.toFixed(2)} MAD
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-[10px] text-muted-foreground italic">Aucun article vendu</p>
                  )}
                </div>
              </div>

              {/* Total Final */}
              <div className="pt-2">
                <div className="flex justify-between items-baseline text-sm font-black">
                  <span>TOTAL GÉNÉRAL ENCAISSÉ :</span>
                  <span className="text-base text-primary">
                    {kpis.total.toFixed(2)} MAD
                  </span>
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-4 border-t border-dashed space-y-6 text-[10px] text-muted-foreground font-sans">
                <div className="flex justify-between pt-2">
                  <div>
                    <p className="font-bold">Signature du Caissier :</p>
                    <div className="mt-6 border-b border-muted-foreground/40 w-32"></div>
                  </div>
                  <div>
                    <p className="font-bold text-right">Visa Responsable :</p>
                    <div className="mt-6 border-b border-muted-foreground/40 w-32"></div>
                  </div>
                </div>
                <p className="text-center text-[9px] opacity-70">
                  Document de contrôle interne certifié conforme à la caisse
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1 rounded-xl gap-2 text-xs"
                onClick={() => {
                  printPosCloture({
                    caissier: activeCashierName,
                    periode: activePeriodLabel,
                    totalVentes: kpis.count,
                    modes: [
                      { mode: "Espèces en Caisse", montant: kpis.totalEspeces, count: kpis.countEspeces },
                      { mode: "Carte Bancaire TPE", montant: kpis.totalCarte, count: kpis.countCarte },
                      { mode: "Chèques", montant: kpis.totalCheque, count: kpis.countCheque },
                      { mode: "Virements", montant: kpis.totalVirement, count: kpis.countVirement },
                    ],
                    totalGeneral: kpis.total,
                    articlesGroupedByUser: clotureArticlesData.articlesGroupedByUser,
                    articlesSummary: clotureArticlesData.articlesSummary,
                  })
                }}
              >
                <Printer className="h-4 w-4" />
                Imprimer le Ticket
              </Button>
              <Button className="flex-1 rounded-xl text-xs font-bold" onClick={() => setClotureModalOpen(false)}>
                Fermer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
