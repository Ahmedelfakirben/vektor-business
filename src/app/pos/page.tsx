"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useVentePosList, useCreateVentePos, useDeleteVentePos, useSoldArticlesPos, useCreateRetourPos, type SoldArticleSummary } from "@/hooks/use-ventes-pos"
import { useFamilles } from "@/hooks/use-familles"
import { useTresoreries } from "@/hooks/use-tresoreries"
import { useDepots } from "@/hooks/use-depots"
import { useClients } from "@/hooks/use-clients"
import type { Article, VentePos } from "@/types/database"
import type { VentePosLigneFormData } from "@/lib/validations/operations"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LoadingScreen } from "@/components/ui/loading-screen"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
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
import { BarcodeScanner } from "@/components/ui/barcode-scanner"
import {
  ShoppingBag,
  History,
  Coins,
  Search,
  Scan,
  Trash2,
  Minus,
  Plus,
  ArrowLeft,
  Maximize2,
  Minimize2,
  Printer,
  CheckCircle2,
  CreditCard,
  Banknote,
  FileCheck2,
  ArrowUpRight,
  TrendingUp,
  ReceiptText,
  Calendar,
  Eye,
  Package,
  Sparkles,
  User,
  Users,
  Building2,
  Wallet,
  ShieldCheck,
  FileSpreadsheet,
  Camera,
  Tag,
  RotateCcw,
  Undo2,
  ArrowDownLeft,
} from "lucide-react"
import { CameraProductScanner } from "@/components/pos/camera-product-scanner"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { printPosTicket, printPosCloture, printPosRetourTicket } from "@/lib/pos-printer"
import { useCompanySettings } from "@/hooks/use-company-settings"

interface CartItem extends VentePosLigneFormData {
  code: string
  image_url?: string | null
  prix_initial?: number
}

const modeLabels: Record<string, string> = {
  especes: "Espèces",
  carte: "Carte Bancaire",
  cheque: "Chèque",
  virement: "Virement",
}

export default function PosTerminalPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialTab = searchParams.get("tab") === "historique" ? "historique" : searchParams.get("tab") === "caisse" ? "caisse" : "pos"
  const [activeTab, setActiveTab] = useState<"pos" | "historique" | "caisse">(initialTab)

  const supabase = createClient()
  const { data: articles, isLoading: isArticlesLoading } = useQuery({
    queryKey: ["articles-active-pos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("*, famille:familles_articles(*), stock(*)")
        .eq("actif", true)
        .order("designation")
      if (error) throw error
      return (data as any[]).map((a) => ({
        ...a,
        stock_actuel: a.stock?.reduce((sum: number, s: any) => sum + s.quantite, 0) || 0,
      })) as Article[]
    },
  })

  const { data: familles } = useFamilles()
  const { data: tresoreries } = useTresoreries()
  const { data: depots } = useDepots()
  const { data: clients } = useClients()
  const { data: allVentes, isLoading: isVentesLoading } = useVentePosList()
  const createVente = useCreateVentePos()
  const deleteVente = useDeleteVentePos()
  const { data: soldArticles, isLoading: isSoldArticlesLoading } = useSoldArticlesPos()
  const createRetour = useCreateRetourPos()

  // POS Return States
  const [retourModalOpen, setRetourModalOpen] = useState(false)
  const [retourSearch, setRetourSearch] = useState("")
  const [selectedSoldArticle, setSelectedSoldArticle] = useState<SoldArticleSummary | null>(null)
  const [retourQuantity, setRetourQuantity] = useState<number>(1)
  const [retourPrice, setRetourPrice] = useState<string>("")
  const [retourDepotId, setRetourDepotId] = useState<string>("")
  const [retourTresorerieId, setRetourTresorerieId] = useState<string>("")
  const [retourModePaiement, setRetourModePaiement] = useState<"especes" | "carte" | "cheque" | "virement">("especes")
  const [retourMotif, setRetourMotif] = useState<string>("")
  const [isScanningRetour, setIsScanningRetour] = useState(false)
  const [completedRetour, setCompletedRetour] = useState<any>(null)
  const [retourReceiptModalOpen, setRetourReceiptModalOpen] = useState(false)

  // POS Selling State
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState("")
  const [selectedFamille, setSelectedFamille] = useState<string>("all")
  const [tresorerieId, setTresorerieId] = useState("")
  const [depotId, setDepotId] = useState("")
  const [clientId, setClientId] = useState("comptoir")
  const [modePaiement, setModePaiement] = useState<"especes" | "carte" | "cheque" | "virement">("especes")
  const [customFinalPrice, setCustomFinalPrice] = useState<string>("")
  const [remiseValue, setRemiseValue] = useState<string>("")
  const [isScanning, setIsScanning] = useState(false)
  const [isVisualScanning, setIsVisualScanning] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [time, setTime] = useState<string>("")
  const [mobileTab, setMobileTab] = useState<"catalog" | "cart">("catalog")
  const [isMounted, setIsMounted] = useState(false)
  const { company: companySettings } = useCompanySettings()

  // Modal / Receipt States
  const [completedSale, setCompletedSale] = useState<any>(null)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [receiptModalOpen, setReceiptModalOpen] = useState(false)
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<any>(null)

  // Today, Month, Year
  const todayStr = new Date().toISOString().split("T")[0]
  const currentMonthStr = todayStr.substring(0, 7)
  const currentYearStr = todayStr.substring(0, 4)

  // Historique Filters
  const [historiqueSearch, setHistoriqueSearch] = useState("")
  const [historiqueDateType, setHistoriqueDateType] = useState<"day" | "month" | "year" | "all">("day")
  const [historiqueSelectedDay, setHistoriqueSelectedDay] = useState(todayStr)
  const [historiqueSelectedMonth, setHistoriqueSelectedMonth] = useState(currentMonthStr)
  const [historiqueSelectedYear, setHistoriqueSelectedYear] = useState(currentYearStr)
  const [historiqueSelectedUser, setHistoriqueSelectedUser] = useState("all")
  const [posClotureModalOpen, setPosClotureModalOpen] = useState(false)

  // Verify user is authenticated
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace("/login?redirectTo=/pos")
      }
    }
    checkAuth()
  }, [router, supabase])

  // Auto-select first depot and tresorerie if available
  useEffect(() => {
    if (!depotId && depots && depots.length > 0) {
      setDepotId(depots[0].id)
    }
  }, [depots, depotId])

  useEffect(() => {
    if (!tresorerieId && tresoreries && tresoreries.length > 0) {
      setTresorerieId(tresoreries[0].id)
    }
  }, [tresoreries, tresorerieId])

  // Live Clock & Mount Check
  useEffect(() => {
    setIsMounted(true)
    const update = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }))
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [])

  // Sync tab with URL
  const handleTabChange = (tab: "pos" | "historique" | "caisse") => {
    setActiveTab(tab)
    router.replace(`/pos?tab=${tab}`, { scroll: false })
  }

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {})
        setIsFullscreen(false)
      }
    }
  }

  // Barcode scanned
  const handleBarcodeScanned = (code: string) => {
    setIsScanning(false)
    const found = articles?.find(
      (a) => (a.code_barre && a.code_barre.toLowerCase() === code.toLowerCase()) || a.code.toLowerCase() === code.toLowerCase()
    )
    if (found) {
      addToCart(found)
      toast.success(`Article ajouté : ${found.designation}`)
    } else {
      setSearch(code)
      toast.error(`Aucun article trouvé pour le code : ${code}`)
    }
  }

  // Cart operations
  const addToCart = (article: Article) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.article_id === article.id)
      if (existing) {
        return prev.map((c) =>
          c.article_id === article.id
            ? { ...c, quantite: c.quantite + 1, montant_ht: (c.quantite + 1) * c.prix_unitaire }
            : c
        )
      }
      return [
        ...prev,
        {
          article_id: article.id,
          code: article.code,
          designation: article.designation,
          quantite: 1,
          prix_unitaire: Number(article.prix_vente),
          prix_initial: Number(article.prix_vente),
          tva: article.tva || 0,
          montant_ht: Number(article.prix_vente),
          image_url: article.image_url,
        },
      ]
    })
  }

  const updateUnitPrice = (article_id: string, newPrice: number) => {
    const validPrice = Math.max(0, isNaN(newPrice) ? 0 : newPrice)
    setCart((prev) =>
      prev.map((c) => {
        if (c.article_id !== article_id) return c
        return {
          ...c,
          prix_unitaire: validPrice,
          montant_ht: Math.round(c.quantite * validPrice * 100) / 100,
        }
      })
    )
    setCustomFinalPrice("")
    setRemiseValue("")
  }

  const updateQty = (article_id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.article_id !== article_id) return c
          const newQty = Math.max(0, c.quantite + delta)
          return { ...c, quantite: newQty, montant_ht: newQty * c.prix_unitaire }
        })
        .filter((c) => c.quantite > 0)
    )
  }

  const removeItem = (article_id: string) => {
    setCart((prev) => prev.filter((c) => c.article_id !== article_id))
  }

  const totalHT = useMemo(() => cart.reduce((s, c) => s + c.montant_ht, 0), [cart])
  const totalTVA = useMemo(() => cart.reduce((s, c) => s + c.montant_ht * (c.tva / 100), 0), [cart])
  const totalTTC = useMemo(() => totalHT + totalTVA, [totalHT, totalTVA])

  // Effective Final Price & Remise computation
  const effectiveFinalPrice = useMemo(() => {
    if (customFinalPrice !== "" && !isNaN(parseFloat(customFinalPrice))) {
      return Math.max(0, parseFloat(customFinalPrice))
    }
    return totalTTC
  }, [customFinalPrice, totalTTC])

  const effectiveRemise = useMemo(() => {
    return Math.max(0, Math.round((totalTTC - effectiveFinalPrice) * 100) / 100)
  }, [totalTTC, effectiveFinalPrice])

  const handleFinalPriceChange = (val: string) => {
    setCustomFinalPrice(val)
    const num = parseFloat(val)
    if (!isNaN(num)) {
      const diff = Math.max(0, totalTTC - num)
      setRemiseValue(diff > 0 ? (Math.round(diff * 100) / 100).toFixed(2) : "0.00")
    } else {
      setRemiseValue("")
    }
  }

  const handleRemiseChange = (val: string) => {
    setRemiseValue(val)
    const num = parseFloat(val)
    if (!isNaN(num)) {
      const finalP = Math.max(0, totalTTC - num)
      setCustomFinalPrice((Math.round(finalP * 100) / 100).toFixed(2))
    } else {
      setCustomFinalPrice("")
    }
  }

  const applyQuickDiscountPercent = (percent: number) => {
    if (percent === 0) {
      setCustomFinalPrice("")
      setRemiseValue("")
      return
    }
    const discount = Math.round(totalTTC * (percent / 100) * 100) / 100
    const finalP = Math.max(0, Math.round((totalTTC - discount) * 100) / 100)
    setRemiseValue(discount.toFixed(2))
    setCustomFinalPrice(finalP.toFixed(2))
  }

  const applyRoundDiscount = () => {
    const rounded = Math.floor(totalTTC / 10) * 10
    if (rounded < totalTTC) {
      const discount = Math.round((totalTTC - rounded) * 100) / 100
      setRemiseValue(discount.toFixed(2))
      setCustomFinalPrice(rounded.toFixed(2))
    }
  }

  // Filtered articles
  const filteredArticles = useMemo(() => {
    return (
      articles?.filter((a) => {
        const matchesSearch =
          a.designation.toLowerCase().includes(search.toLowerCase()) ||
          a.code.toLowerCase().includes(search.toLowerCase()) ||
          (a.code_barre && a.code_barre.toLowerCase().includes(search.toLowerCase()))

        const matchesFamille = selectedFamille === "all" || a.famille_id === selectedFamille
        return matchesSearch && matchesFamille
      }) || []
    )
  }, [articles, search, selectedFamille])

  // Finalize Sale
  const handleFinalize = async () => {
    if (cart.length === 0) {
      toast.error("Le panier est vide")
      return
    }
    if (!tresorerieId) {
      toast.error("Veuillez sélectionner une caisse / trésorerie")
      return
    }
    if (!depotId) {
      toast.error("Veuillez sélectionner un dépôt")
      return
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const { data: profile } = (await supabase
        .from("profiles")
        .select("id, prenom, nom, email")
        .eq("user_id", user?.id || "")
        .maybeSingle()) as any

      const initialTotal = totalTTC
      const finalAmount = effectiveFinalPrice
      const remiseVal = effectiveRemise

      // Prorate lines proportionally so line totals match final discounted amount exactly
      const discountFactor = initialTotal > 0 ? finalAmount / initialTotal : 1
      let runningSum = 0
      const proratedLines = cart.map((ligne, idx) => {
        const isLast = idx === cart.length - 1
        let adjustedPu = Math.round(ligne.prix_unitaire * discountFactor * 100) / 100
        let lineTotal = Math.round(adjustedPu * ligne.quantite * 100) / 100
        if (isLast) {
          lineTotal = Math.round((finalAmount - runningSum) * 100) / 100
          adjustedPu = ligne.quantite > 0 ? Math.round((lineTotal / ligne.quantite) * 100) / 100 : lineTotal
        } else {
          runningSum += lineTotal
        }
        return {
          ...ligne,
          prix_unitaire: adjustedPu,
          montant_ht: lineTotal,
        }
      })

      const result = await createVente.mutateAsync({
        formData: {
          client_id: clientId === "comptoir" ? null : clientId,
          tresorerie_id: tresorerieId,
          depot_id: depotId,
          mode_paiement: modePaiement,
          inclure_tva: false,
          montant_ht: finalAmount,
          montant_ttc: finalAmount,
          remise: remiseVal,
          lignes: proratedLines.map(({ code, image_url, prix_initial, ...l }) => l),
        },
        commercial_id: profile?.id || "",
      })

      const clientName = clientId === "comptoir" ? "Comptoir" : clients?.find((c) => c.id === clientId)?.raison_sociale || "Client"
      const tresoName = tresoreries?.find((t) => t.id === tresorerieId)?.libelle || "Caisse"
      const cashierName = [profile?.prenom, profile?.nom].filter(Boolean).join(" ") || user?.email?.split("@")[0] || "Caissier"

      setCompletedSale({
        numero: (result as any)?.numero || `VP-${Date.now()}`,
        date: new Date().toISOString(),
        clientName,
        tresoName,
        cashierName,
        mode_paiement: modePaiement,
        lignes: proratedLines,
        totalInitial: initialTotal,
        remise: remiseVal,
        montant_ht: finalAmount,
        montant_tva: 0,
        montant_ttc: finalAmount,
      })

      setPaymentModalOpen(false)
      setReceiptModalOpen(true)
      setCart([])
      setCustomFinalPrice("")
      setRemiseValue("")
      toast.success("Vente enregistrée avec succès !")
    } catch (err: any) {
      console.error("Vente error:", err)
      toast.error(err?.message || "Erreur lors de l'enregistrement de la vente")
    }
  }

  // Filtered sold articles for Returns
  const filteredSoldArticles = useMemo(() => {
    if (!soldArticles) return []
    const q = retourSearch.trim().toLowerCase()
    if (!q) return soldArticles
    return soldArticles.filter(
      (a) =>
        a.designation.toLowerCase().includes(q) ||
        a.code.toLowerCase().includes(q) ||
        (a.code_barre && a.code_barre.toLowerCase().includes(q)) ||
        a.ventes_recents.some((v) => v.numero.toLowerCase().includes(q))
    )
  }, [soldArticles, retourSearch])

  // Barcode scanned in Retour modal
  const handleRetourBarcodeScanned = (code: string) => {
    setIsScanningRetour(false)
    const match = soldArticles?.find(
      (a) =>
        (a.code_barre && a.code_barre.toLowerCase() === code.toLowerCase()) ||
        a.code.toLowerCase() === code.toLowerCase()
    )
    if (match) {
      setSelectedSoldArticle(match)
      setRetourQuantity(1)
      setRetourPrice(
        (match.ventes_recents[0]?.prix_unitaire || match.prix_vente).toFixed(2)
      )
      toast.success(`Article vendu sélectionné : ${match.designation}`)
    } else {
      setRetourSearch(code)
      toast.error(`Aucun article vendu trouvé pour le code : ${code}`)
    }
  }

  // Confirm and Process Retour
  const handleConfirmRetour = async () => {
    if (!selectedSoldArticle) {
      toast.error("Veuillez sélectionner un article vendu")
      return
    }
    const qty = Number(retourQuantity)
    if (!qty || qty <= 0) {
      toast.error("Veuillez saisir une quantité valide")
      return
    }
    if (qty > selectedSoldArticle.quantite_vendue) {
      toast.error(
        `La quantité retournée ne peut pas dépasser la quantité vendue (${selectedSoldArticle.quantite_vendue})`
      )
      return
    }
    const unitPrice = parseFloat(retourPrice) || selectedSoldArticle.prix_vente
    const targetDepotId = retourDepotId || depotId
    const targetTresoId = retourTresorerieId || tresorerieId

    if (!targetDepotId) {
      toast.error("Veuillez sélectionner un dépôt de réintégration")
      return
    }
    if (!targetTresoId) {
      toast.error("Veuillez sélectionner une caisse pour le remboursement")
      return
    }

    try {
      const totalRembourse = Math.round(qty * unitPrice * 100) / 100
      const recentSale = selectedSoldArticle.ventes_recents[0]

      const {
        data: { user },
      } = await supabase.auth.getUser()
      const { data: profile } = (await (supabase.from("profiles") as any)
        .select("id, prenom, nom, email")
        .eq("user_id", user?.id || "")
        .maybeSingle()) as any

      const result = await createRetour.mutateAsync({
        vente_pos_id: recentSale?.vente_id || null,
        commercial_id: profile?.id,
        depot_id: targetDepotId,
        tresorerie_id: targetTresoId,
        montant_total: totalRembourse,
        mode_remboursement: retourModePaiement,
        motif: retourMotif || "Retour client au comptoir",
        lignes: [
          {
            article_id: selectedSoldArticle.article_id,
            designation: selectedSoldArticle.designation,
            quantite: qty,
            prix_unitaire: unitPrice,
            montant_total: totalRembourse,
          },
        ],
      })

      const cashierName =
        [profile?.prenom, profile?.nom].filter(Boolean).join(" ") ||
        user?.email?.split("@")[0] ||
        "Caissier"

      setCompletedRetour({
        numero: (result as any)?.numero || `RET-${Date.now()}`,
        date: new Date().toISOString(),
        cashierName,
        clientName: "Comptoir",
        mode_remboursement: modeLabels[retourModePaiement] || retourModePaiement,
        motif: retourMotif || "Retour client",
        montant_total: totalRembourse,
        lignes: [
          {
            designation: selectedSoldArticle.designation,
            quantite: qty,
            prix_unitaire: unitPrice,
            montant_total: totalRembourse,
          },
        ],
      })

      setRetourModalOpen(false)
      setSelectedSoldArticle(null)
      setRetourSearch("")
      setRetourReceiptModalOpen(true)
      toast.success("Retour enregistré et stock réintégré avec succès !")
    } catch (err: any) {
      console.error("Retour error:", err)
      toast.error(err?.message || "Erreur lors de l'enregistrement du retour")
    }
  }


  // Caisse calculations
  const todayVentes = useMemo(() => {
    return (
      allVentes?.filter((v) => {
        return v.date === todayStr || (v.created_at && v.created_at.startsWith(todayStr))
      }) || []
    )
  }, [allVentes, todayStr])

  const caisseStats = useMemo(() => {
    const totalJour = todayVentes.reduce((acc, v) => acc + Number(v.montant_ttc || 0), 0)
    const totalEspeces = todayVentes
      .filter((v) => v.mode_paiement === "especes")
      .reduce((acc, v) => acc + Number(v.montant_ttc || 0), 0)
    const totalCarte = todayVentes
      .filter((v) => v.mode_paiement === "carte")
      .reduce((acc, v) => acc + Number(v.montant_ttc || 0), 0)
    const totalCheque = todayVentes
      .filter((v) => v.mode_paiement === "cheque")
      .reduce((acc, v) => acc + Number(v.montant_ttc || 0), 0)
    const totalVirement = todayVentes
      .filter((v) => v.mode_paiement === "virement")
      .reduce((acc, v) => acc + Number(v.montant_ttc || 0), 0)

    const countTotal = todayVentes.length
    const countEspeces = todayVentes.filter((v) => v.mode_paiement === "especes").length
    const countCarte = todayVentes.filter((v) => v.mode_paiement === "carte").length
    const countCheque = todayVentes.filter((v) => v.mode_paiement === "cheque").length
    const panierMoyen = countTotal > 0 ? totalJour / countTotal : 0

    return {
      totalJour,
      totalEspeces,
      totalCarte,
      totalCheque,
      totalVirement,
      countTotal,
      countEspeces,
      countCarte,
      countCheque,
      panierMoyen,
    }
  }, [todayVentes])

  // Unique Users List from Ventes
  const uniqueUsers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; email?: string }>()
    allVentes?.forEach((v) => {
      if (v.commercial_id) {
        const name =
          [v.commercial?.prenom, v.commercial?.nom].filter(Boolean).join(" ") ||
          v.commercial?.email ||
          "Utilisateur"
        map.set(v.commercial_id, { id: v.commercial_id, name, email: v.commercial?.email })
      }
    })
    return Array.from(map.values())
  }, [allVentes])

  // Available years
  const availableYears = useMemo(() => {
    const years = new Set<string>()
    years.add(currentYearStr)
    allVentes?.forEach((v) => {
      const y = (v.date || v.created_at || "").substring(0, 4)
      if (y && y.length === 4) years.add(y)
    })
    return Array.from(years).sort().reverse()
  }, [allVentes, currentYearStr])

  // Historique List
  const filteredHistorique = useMemo(() => {
    return (
      allVentes?.filter((v) => {
        const matchesSearch =
          v.numero.toLowerCase().includes(historiqueSearch.toLowerCase()) ||
          (v.client?.raison_sociale && v.client.raison_sociale.toLowerCase().includes(historiqueSearch.toLowerCase())) ||
          (v.tresorerie?.libelle && v.tresorerie.libelle.toLowerCase().includes(historiqueSearch.toLowerCase()))

        if (!matchesSearch) return false

        // User filter
        if (historiqueSelectedUser !== "all" && v.commercial_id !== historiqueSelectedUser) {
          return false
        }

        // Date filter
        const vDate = v.date || (v.created_at ? v.created_at.split("T")[0] : "")
        if (historiqueDateType === "day") {
          return vDate === historiqueSelectedDay
        }
        if (historiqueDateType === "month") {
          return vDate.startsWith(historiqueSelectedMonth)
        }
        if (historiqueDateType === "year") {
          return vDate.startsWith(historiqueSelectedYear)
        }

        return true
      }) || []
    )
  }, [allVentes, historiqueSearch, historiqueSelectedUser, historiqueDateType, historiqueSelectedDay, historiqueSelectedMonth, historiqueSelectedYear])

  // Historique KPIs for closing
  const historiqueKpis = useMemo(() => {
    const total = filteredHistorique.reduce((acc, v) => acc + Number(v.montant_ttc || 0), 0)
    const totalEspeces = filteredHistorique
      .filter((v) => v.mode_paiement === "especes")
      .reduce((acc, v) => acc + Number(v.montant_ttc || 0), 0)
    const totalCarte = filteredHistorique
      .filter((v) => v.mode_paiement === "carte")
      .reduce((acc, v) => acc + Number(v.montant_ttc || 0), 0)
    const totalCheque = filteredHistorique
      .filter((v) => v.mode_paiement === "cheque")
      .reduce((acc, v) => acc + Number(v.montant_ttc || 0), 0)
    const totalVirement = filteredHistorique
      .filter((v) => v.mode_paiement === "virement")
      .reduce((acc, v) => acc + Number(v.montant_ttc || 0), 0)

    const count = filteredHistorique.length
    const countEspeces = filteredHistorique.filter((v) => v.mode_paiement === "especes").length
    const countCarte = filteredHistorique.filter((v) => v.mode_paiement === "carte").length
    const countCheque = filteredHistorique.filter((v) => v.mode_paiement === "cheque").length
    const countVirement = filteredHistorique.filter((v) => v.mode_paiement === "virement").length

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
  }, [filteredHistorique])

  // Detailed articles breakdown for Clôture de Caisse (by seller & global)
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

    filteredHistorique.forEach((v) => {
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
  }, [filteredHistorique])

  const posActiveCashierName = useMemo(() => {
    if (historiqueSelectedUser === "all") return "Tous les caissiers"
    const u = uniqueUsers.find((user) => user.id === historiqueSelectedUser)
    return u ? u.name : "Caissier"
  }, [historiqueSelectedUser, uniqueUsers])

  const posActivePeriodLabel = useMemo(() => {
    if (historiqueDateType === "day") {
      return new Date(historiqueSelectedDay).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    }
    if (historiqueDateType === "month") {
      const [y, m] = historiqueSelectedMonth.split("-")
      const d = new Date(parseInt(y), parseInt(m) - 1, 1)
      return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    }
    if (historiqueDateType === "year") {
      return `Année ${historiqueSelectedYear}`
    }
    return "Toutes les dates"
  }, [historiqueDateType, historiqueSelectedDay, historiqueSelectedMonth, historiqueSelectedYear])

  const handleDeleteVente = async (id: string) => {
    try {
      await deleteVente.mutateAsync(id)
      toast.success("Vente supprimée")
    } catch {
      toast.error("Erreur lors de la suppression de la vente")
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background select-none overflow-hidden">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER (FACEBOOK STYLE) */}
      {/* ========================================================================= */}
      <header className="h-14 sm:h-16 border-b bg-card/95 backdrop-blur px-2.5 sm:px-6 flex items-center justify-between shrink-0 z-30 shadow-xs gap-1 sm:gap-4">
        {/* Left: Brand & Clock */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div
            onClick={() => handleTabChange("pos")}
            className="flex items-center gap-2 select-none cursor-pointer"
            title="Linventory POS"
          >
            <div className="h-8 w-8 sm:h-10 sm:w-10 overflow-hidden rounded-xl shadow-md ring-1 ring-orange-500/30 bg-slate-950 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.jpeg" alt="Linventory" className="h-full w-full object-cover" />
            </div>
            <div className="hidden lg:block">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-base tracking-tight text-foreground">Linventory</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-bold border-orange-500/30 text-orange-600 dark:text-orange-400 bg-orange-500/10">
                  POS
                </Badge>
              </div>
              <p className="text-[11px] font-medium text-muted-foreground tabular-nums">
                {isMounted ? (time || "--:--:--") : "--:--:--"}
              </p>
            </div>
          </div>
        </div>

        {/* Center: 3 FACEBOOK-STYLE NAV BUTTONS */}
        <nav className="flex items-center gap-0.5 sm:gap-2 bg-muted/60 p-0.5 sm:p-1 rounded-xl sm:rounded-2xl border border-border/50 shadow-inner">
          {/* BUTTON 1: POS */}
          <button
            type="button"
            onClick={() => handleTabChange("pos")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 sm:px-7 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm transition-all duration-150 select-none cursor-pointer relative",
              activeTab === "pos"
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/25 scale-[1.02]"
                : "text-muted-foreground hover:text-foreground hover:bg-background/80"
            )}
          >
            <ShoppingBag className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span>POS</span>
            {cart.length > 0 && (
              <span
                className={cn(
                  "ml-0.5 px-1.5 py-0.2 text-[10px] sm:text-[11px] font-black rounded-full",
                  activeTab === "pos" ? "bg-white text-primary" : "bg-primary text-primary-foreground"
                )}
              >
                {cart.length}
              </span>
            )}
          </button>

          {/* BUTTON 2: HISTORIQUE */}
          <button
            type="button"
            onClick={() => handleTabChange("historique")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 sm:px-7 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm transition-all duration-150 select-none cursor-pointer relative",
              activeTab === "historique"
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/25 scale-[1.02]"
                : "text-muted-foreground hover:text-foreground hover:bg-background/80"
            )}
          >
            <History className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span className="hidden sm:inline">Historique</span>
            <span className="sm:hidden">Hist.</span>
            {isMounted && todayVentes.length > 0 && (
              <span
                className={cn(
                  "ml-0.5 px-1.5 py-0.2 text-[10px] sm:text-[11px] font-black rounded-full",
                  activeTab === "historique" ? "bg-white/20 text-white" : "bg-muted-foreground/20 text-foreground"
                )}
              >
                {todayVentes.length}
              </span>
            )}
          </button>

          {/* BUTTON 3: CAISSE */}
          <button
            type="button"
            onClick={() => handleTabChange("caisse")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 sm:px-7 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm transition-all duration-150 select-none cursor-pointer relative",
              activeTab === "caisse"
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/25 scale-[1.02]"
                : "text-muted-foreground hover:text-foreground hover:bg-background/80"
            )}
          >
            <Coins className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span>Caisse</span>
          </button>
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRetourSearch("")
              setSelectedSoldArticle(null)
              setRetourQuantity(1)
              setRetourPrice("")
              setRetourMotif("")
              setRetourDepotId(depotId)
              setRetourTresorerieId(tresorerieId)
              setRetourModalOpen(true)
            }}
            className="h-8 sm:h-9 rounded-xl text-xs font-bold gap-1.5 border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 cursor-pointer shadow-xs"
            title="Retourner un produit vendu et rembourser"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Retour Vente</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
            className="rounded-xl h-8 w-8 sm:h-9 sm:w-9 text-muted-foreground hover:text-foreground"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. BODY CONTENT - TABS */}
      {/* ========================================================================= */}
      <main className="flex-1 flex overflow-hidden">
        {/* --------------------------------------------------------------------- */}
        {/* TAB 1: POS TERMINAL */}
        {/* --------------------------------------------------------------------- */}
        {activeTab === "pos" && (
          <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden animate-in fade-in-50 duration-150 relative">
            {/* Left Products Area */}
            <div
              className={cn(
                "flex-1 flex-col min-w-0 p-3 sm:p-5 overflow-hidden gap-3",
                mobileTab === "cart" ? "hidden md:flex" : "flex"
              )}
            >
              {/* Search & Scanner Row */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Rechercher article, code barre..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 pr-10 h-10 sm:h-11 rounded-xl bg-card border-border/70 text-xs sm:text-sm shadow-xs focus-visible:ring-primary"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <Button
                  variant="outline"
                  onClick={() => setIsScanning(!isScanning)}
                  className={cn(
                    "h-10 sm:h-11 px-3 sm:px-3.5 rounded-xl gap-1.5 sm:gap-2 border-border/70 font-semibold text-xs shrink-0 cursor-pointer",
                    isScanning && "bg-primary text-primary-foreground border-primary"
                  )}
                >
                  <Scan className="h-4 w-4" />
                  <span className="hidden sm:inline">Scanner</span>
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setIsVisualScanning(true)}
                  className="h-10 sm:h-11 px-3 sm:px-3.5 rounded-xl gap-1.5 sm:gap-2 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 font-bold text-xs shrink-0 cursor-pointer shadow-xs"
                  title="Identifier instantanément un produit par photo (Moteur visuel TPV)"
                >
                  <Camera className="h-4 w-4 text-emerald-600" />
                  <span className="hidden sm:inline">Reconnaissance Visuelle</span>
                </Button>
              </div>

              {/* Barcode scanner dialog/camera */}
              {isScanning && (
                <div className="p-3 bg-card border rounded-2xl shadow-sm">
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-xs font-semibold text-muted-foreground">Visez le code-barre avec la caméra</span>
                    <Button variant="ghost" size="sm" onClick={() => setIsScanning(false)} className="h-6 text-xs px-2">
                      Fermer
                    </Button>
                  </div>
                  <BarcodeScanner onScan={handleBarcodeScanned} onClose={() => setIsScanning(false)} />
                </div>
              )}

              {/* Familles Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0 no-scrollbar">
                <button
                  type="button"
                  onClick={() => setSelectedFamille("all")}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all select-none cursor-pointer shrink-0",
                    selectedFamille === "all"
                      ? "bg-foreground text-background shadow-xs"
                      : "bg-muted/70 text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  Tous
                </button>
                {familles?.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedFamille(f.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all select-none cursor-pointer shrink-0",
                      selectedFamille === f.id
                        ? "bg-foreground text-background shadow-xs"
                        : "bg-muted/70 text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    {f.libelle}
                  </button>
                ))}
              </div>

              {/* Products Grid */}
              <div className="flex-1 overflow-y-auto pr-0.5 pb-20 md:pb-1">
                {isArticlesLoading ? (
                  <div className="h-64 flex items-center justify-center">
                    <LoadingScreen />
                  </div>
                ) : filteredArticles.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-center p-6 rounded-2xl border border-dashed text-muted-foreground">
                    <Package className="h-10 w-10 mb-2 opacity-40" />
                    <p className="font-semibold text-sm">Aucun article trouvé</p>
                    <p className="text-xs mt-1">Modifiez vos critères de recherche ou réinitialisez les filtres.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
                    {filteredArticles.map((article) => {
                      const inCart = cart.find((c) => c.article_id === article.id)
                      const stock = (article as any).stock_actuel ?? 0

                      return (
                        <Card
                          key={article.id}
                          onClick={() => addToCart(article)}
                          className={cn(
                            "cursor-pointer hover:border-primary hover:shadow-md transition-all duration-150 overflow-hidden flex flex-col justify-between group rounded-2xl border-border/70 relative select-none",
                            inCart && "ring-2 ring-primary border-primary bg-primary/5"
                          )}
                        >
                          {inCart && (
                            <span className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 z-10 h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-primary text-primary-foreground font-black text-[10px] sm:text-xs flex items-center justify-center shadow-md animate-in zoom-in-50">
                              {inCart.quantite}
                            </span>
                          )}

                          {article.image_url ? (
                            <div className="h-24 sm:h-28 w-full bg-muted/40 overflow-hidden shrink-0 border-b border-border/40">
                              <img
                                src={article.image_url}
                                alt={article.designation}
                                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                            </div>
                          ) : (
                            <div className="h-24 sm:h-28 w-full bg-muted/30 flex items-center justify-center border-b border-border/40">
                              <Package className="h-7 w-7 text-muted-foreground/40 group-hover:scale-110 transition-transform" />
                            </div>
                          )}

                          <CardContent className="p-2 sm:p-3 flex-1 flex flex-col justify-between">
                            <div>
                              <p className="font-bold text-xs sm:text-sm line-clamp-2 leading-snug group-hover:text-primary transition-colors" title={article.designation}>
                                {article.designation}
                              </p>
                              <div className="flex items-center justify-between mt-1 text-[10px] sm:text-[11px] text-muted-foreground">
                                <span className="truncate max-w-[65px]">{article.code}</span>
                                <span className={cn(
                                  "font-bold px-1 py-0.2 rounded text-[9px] sm:text-[10px]",
                                  stock > 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"
                                )}>
                                  Stk: {stock}
                                </span>
                              </div>
                            </div>

                            <div className="mt-2 pt-1.5 border-t border-border/40 flex items-center justify-between">
                              <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">Prix</span>
                              <span className="font-extrabold text-xs sm:text-base text-foreground group-hover:text-primary">
                                {Number(article.prix_vente).toFixed(2)} <span className="text-[10px] sm:text-xs font-semibold">MAD</span>
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Floating Cart Summary Bar */}
            {cart.length > 0 && mobileTab === "catalog" && (
              <div className="md:hidden fixed bottom-3 left-3 right-3 z-30 animate-in slide-in-from-bottom-5">
                <Button
                  size="lg"
                  onClick={() => setMobileTab("cart")}
                  className="w-full h-13 rounded-2xl shadow-xl shadow-primary/30 flex items-center justify-between px-4 font-black text-sm bg-primary text-primary-foreground hover:bg-primary/95 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-primary-foreground/20 flex items-center justify-center font-bold">
                      <ShoppingBag className="h-4 w-4" />
                    </div>
                    <span className="text-xs sm:text-sm">
                      Voir Panier ({cart.reduce((s, c) => s + c.quantite, 0)})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm sm:text-base">
                    <span>{totalTTC.toFixed(2)} MAD</span>
                    <span className="text-xs font-bold opacity-80">→</span>
                  </div>
                </Button>
              </div>
            )}

            {/* Right Cart & Checkout Panel */}
            <div
              className={cn(
                "w-full md:w-[420px] lg:w-[450px] border-t md:border-t-0 md:border-l bg-card flex-col shrink-0 shadow-lg z-20",
                mobileTab === "catalog" ? "hidden md:flex" : "flex flex-1 md:flex-initial"
              )}
            >
              {/* Cart Header */}
              <div className="p-3 sm:p-4 border-b flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  {/* Mobile Back Button to Catalog */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMobileTab("catalog")}
                    className="md:hidden h-8 px-2 rounded-lg text-xs gap-1 font-bold mr-1"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Articles</span>
                  </Button>

                  <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <ShoppingBag className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Ticket en cours</h3>
                    <p className="text-xs text-muted-foreground">
                      {cart.reduce((s, c) => s + c.quantite, 0)} articles
                    </p>
                  </div>
                </div>

                {cart.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCart([])}
                    className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                  >
                    Vider
                  </Button>
                )}
              </div>

              {/* Cart Selectors: Client, Dépôt & Caisse */}
              <div className="px-3.5 py-2.5 bg-muted/30 border-b shrink-0 space-y-2">
                {/* Client selector - Full width with quick reset */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    <span className="flex items-center gap-1.5 text-foreground">
                      <Users className="h-3 w-3 text-orange-500" />
                      Client
                    </span>
                    {clientId !== "comptoir" && (
                      <button
                        type="button"
                        onClick={() => setClientId("comptoir")}
                        className="text-[10px] text-orange-500 hover:text-orange-600 font-semibold cursor-pointer underline"
                      >
                        Remettre Comptoir
                      </button>
                    )}
                  </div>
                  <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger className="h-8 w-full text-xs font-semibold rounded-lg bg-background px-2.5">
                      <SelectValue placeholder="Sélectionner client" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="comptoir" className="text-xs font-semibold">
                        Comptoir (Vente Directe)
                      </SelectItem>
                      {clients?.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">
                          {c.raison_sociale}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Dépôt & Caisse in 2 equal, clean columns */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1 min-w-0">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1 truncate">
                      <Building2 className="h-3 w-3 text-muted-foreground/70" />
                      Dépôt
                    </span>
                    <Select value={depotId} onValueChange={setDepotId}>
                      <SelectTrigger className="h-8 w-full text-xs font-medium rounded-lg bg-background px-2">
                        <SelectValue placeholder="Dépôt" />
                      </SelectTrigger>
                      <SelectContent>
                        {depots?.map((d) => (
                          <SelectItem key={d.id} value={d.id} className="text-xs">
                            {d.libelle}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1 min-w-0">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1 truncate">
                      <Wallet className="h-3 w-3 text-muted-foreground/70" />
                      Caisse
                    </span>
                    <Select value={tresorerieId} onValueChange={setTresorerieId}>
                      <SelectTrigger className="h-8 w-full text-xs font-medium rounded-lg bg-background px-2">
                        <SelectValue placeholder="Caisse" />
                      </SelectTrigger>
                      <SelectContent>
                        {tresoreries?.map((t) => (
                          <SelectItem key={t.id} value={t.id} className="text-xs">
                            {t.libelle}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Cart Items List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {cart.length === 0 ? (
                  <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                    <ShoppingBag className="h-10 w-10 mb-2 opacity-30" />
                    <p className="font-semibold text-sm">Le panier est vide</p>
                    <p className="text-xs mt-1">Sélectionnez ou scannez des articles pour commencer la vente.</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div
                      key={item.article_id}
                      className="flex items-center gap-2 p-2.5 rounded-xl border border-border/60 bg-card hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-xs truncate" title={item.designation}>
                          {item.designation}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div className="flex items-center gap-1 bg-muted/60 hover:bg-muted px-1.5 py-0.5 rounded-md border border-border/60 transition-colors">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.prix_unitaire}
                              onChange={(e) => updateUnitPrice(item.article_id, parseFloat(e.target.value))}
                              className="w-16 text-right font-black text-xs bg-transparent border-none focus:outline-none p-0 text-foreground"
                              title="Cliquer pour modifier le prix unitaire"
                            />
                            <span className="text-[10px] font-bold text-muted-foreground">MAD</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground font-medium">× {item.quantite}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => updateQty(item.article_id, -1)}
                          className="h-7 w-7 rounded-lg"
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-7 text-center font-black text-xs">{item.quantite}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => updateQty(item.article_id, 1)}
                          className="h-7 w-7 rounded-lg"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>

                      <div className="w-20 text-right font-black text-xs text-foreground shrink-0">
                        {item.montant_ht.toFixed(2)} <span className="text-[10px] font-normal text-muted-foreground">MAD</span>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(item.article_id)}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </div>

              {/* Cart Footer: Totals & Modal Trigger */}
              <div className="p-3.5 border-t bg-muted/20 space-y-3 shrink-0">
                {/* Articles count */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{cart.reduce((acc, item) => acc + item.quantite, 0)} article(s)</span>
                </div>

                {/* Grand Total */}
                <div className="flex items-baseline justify-between pt-0.5">
                  <span className="font-extrabold text-sm text-muted-foreground">TOTAL À PAYER</span>
                  <div className="text-right">
                    <span className="text-3xl font-black text-foreground tracking-tight">
                      {totalTTC.toFixed(2)}
                    </span>
                    <span className="text-sm font-bold text-muted-foreground ml-1.5">MAD</span>
                  </div>
                </div>

                {/* Finalize button opens payment modal */}
                <Button
                  size="lg"
                  disabled={cart.length === 0}
                  onClick={() => {
                    setCustomFinalPrice("")
                    setRemiseValue("")
                    setPaymentModalOpen(true)
                  }}
                  className="w-full h-12 rounded-xl text-base font-extrabold gap-2 shadow-lg shadow-primary/25 cursor-pointer"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Valider & Encaisser</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* --------------------------------------------------------------------- */}
        {/* TAB 2: HISTORIQUE */}
        {/* --------------------------------------------------------------------- */}
        {activeTab === "historique" && (
          <div className="flex-1 flex flex-col h-full overflow-hidden p-4 sm:p-6 max-w-7xl mx-auto w-full gap-4 animate-in fade-in-50 duration-150">
            {/* Header & Clôture Trigger */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div>
                <h2 className="text-2xl font-black tracking-tight">Historique des Ventes POS</h2>
                <p className="text-xs text-muted-foreground">
                  Consultez, filtrez par caissier/période et imprimez le ticket de clôture de caisse
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPosClotureModalOpen(true)}
                  className="rounded-xl gap-2 font-bold text-xs border-primary/30 text-primary hover:bg-primary/10 shadow-xs cursor-pointer"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>Ticket Clôture de Caisse</span>
                </Button>
              </div>
            </div>

            {/* Granular Filters: Recherche + Jour / Mois / Année / Tout + Caissier */}
            <div className="p-3.5 rounded-2xl border bg-card/80 backdrop-blur-xs shadow-xs space-y-3 shrink-0">
              <div className="flex flex-col lg:flex-row gap-2.5 items-stretch lg:items-center justify-between">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher par N° ticket ou client..."
                    value={historiqueSearch}
                    onChange={(e) => setHistoriqueSearch(e.target.value)}
                    className="pl-9 h-9 rounded-xl text-xs bg-background"
                  />
                </div>

                {/* Granular Date Filters */}
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
                        onClick={() => setHistoriqueDateType(dt.id as any)}
                        className={cn(
                          "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                          historiqueDateType === dt.id
                            ? "bg-background text-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {dt.label}
                      </button>
                    ))}
                  </div>

                  {/* Dynamic Date Inputs */}
                  {historiqueDateType === "day" && (
                    <Input
                      type="date"
                      value={historiqueSelectedDay}
                      onChange={(e) => setHistoriqueSelectedDay(e.target.value)}
                      className="h-9 w-[150px] text-xs font-medium rounded-xl bg-background"
                    />
                  )}

                  {historiqueDateType === "month" && (
                    <Input
                      type="month"
                      value={historiqueSelectedMonth}
                      onChange={(e) => setHistoriqueSelectedMonth(e.target.value)}
                      className="h-9 w-[150px] text-xs font-medium rounded-xl bg-background"
                    />
                  )}

                  {historiqueDateType === "year" && (
                    <Select value={historiqueSelectedYear} onValueChange={setHistoriqueSelectedYear}>
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
                  <Select value={historiqueSelectedUser} onValueChange={setHistoriqueSelectedUser}>
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
                </div>
              </div>

              {/* Active Filter Summary Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground">Filtre :</span>
                  <Badge variant="secondary" className="text-[11px] font-semibold">
                    {posActivePeriodLabel}
                  </Badge>
                  <Badge variant="outline" className="text-[11px] font-medium border-primary/30 text-primary">
                    Caissier : {posActiveCashierName}
                  </Badge>
                </div>

                <div className="flex items-center gap-3 font-semibold text-foreground">
                  <span>{filteredHistorique.length} ticket(s)</span>
                  <span>•</span>
                  <span className="text-primary font-black">
                    Total : {historiqueKpis.total.toFixed(2)} MAD
                  </span>
                </div>
              </div>
            </div>

            {/* Tickets Table / List */}
            <div className="flex-1 overflow-y-auto rounded-2xl border bg-card shadow-xs">
              {isVentesLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <LoadingScreen />
                </div>
              ) : filteredHistorique.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                  <History className="h-10 w-10 mb-2 opacity-30" />
                  <p className="font-semibold text-sm">Aucune vente trouvée</p>
                  <p className="text-xs mt-1">Aucun ticket ne correspond à vos filtres actuels.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {filteredHistorique.map((vente) => {
                    const userName =
                      [vente.commercial?.prenom, vente.commercial?.nom].filter(Boolean).join(" ") ||
                      vente.commercial?.email ||
                      "Caissier"

                    return (
                      <div
                        key={vente.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                            <ReceiptText className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-sm text-foreground">{vente.numero}</span>
                              <Badge variant="outline" className="text-[10px] font-semibold">
                                {modeLabels[vente.mode_paiement] || vente.mode_paiement}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                              <span className="inline-flex items-center gap-1 font-semibold text-foreground bg-muted/80 px-2 py-0.5 rounded-md text-[11px]">
                                <User className="h-3 w-3 text-primary" />
                                {userName}
                              </span>
                              <span>•</span>
                              <span>Client : {vente.client?.raison_sociale || "Comptoir"}</span>
                              <span>•</span>
                              <span>
                                {new Date(vente.date).toLocaleDateString("fr-FR")}
                                {vente.created_at &&
                                  ` à ${new Date(vente.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4">
                          <div className="text-right">
                            <span className="text-lg font-black text-foreground">
                              {Number(vente.montant_ttc).toFixed(2)}
                            </span>
                            <span className="text-xs font-bold text-muted-foreground ml-1">MAD</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedSaleDetail(vente)}
                              className="h-8 rounded-lg text-xs gap-1.5 font-medium cursor-pointer"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Voir
                            </Button>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive rounded-lg cursor-pointer"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="rounded-2xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Confirmer l&apos;annulation du ticket</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Voulez-vous vraiment supprimer le ticket {vente.numero} d&apos;un montant de{" "}
                                    {Number(vente.montant_ttc).toFixed(2)} MAD ? Cette action est irréversible.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="rounded-xl">Annuler</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteVente(vente.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
                                  >
                                    Supprimer
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --------------------------------------------------------------------- */}
        {/* TAB 3: CAISSE - RÉSULTAT DU JOUR EN GRAND */}
        {/* --------------------------------------------------------------------- */}
        {activeTab === "caisse" && (
          <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full gap-6 animate-in fade-in-50 duration-150">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs px-2.5 py-0.5 border-emerald-500/30 text-emerald-600 bg-emerald-500/10 font-bold">
                    Point de Vente • Bilan Journalier
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-1">
                  Résultat de Caisse
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => window.print()}
                  className="rounded-xl gap-2 font-semibold text-xs border-border/80"
                >
                  <Printer className="h-4 w-4" />
                  Imprimer Bilan (Z de Caisse)
                </Button>
              </div>
            </div>

            {/* ================================================================= */}
            {/* BIG HERO DISPLAY CARD (PROMINENT FIGURES) */}
            {/* ================================================================= */}
            <div className="shrink-0 w-full rounded-3xl border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-6 sm:p-8 shadow-lg shadow-emerald-500/5 relative overflow-hidden">
              <div className="absolute right-6 top-6 opacity-10 pointer-events-none">
                <Coins className="h-40 w-40 text-emerald-500" />
              </div>

              <div className="relative z-10 flex flex-col gap-6">
                <div>
                  <p className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                    Chiffre d&apos;Affaires Encaissé Aujourd&apos;hui
                  </p>
                  <div className="flex items-baseline gap-3 mt-3 flex-wrap">
                    <span className="text-5xl sm:text-6xl md:text-7xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight leading-tight">
                      {caisseStats.totalJour.toFixed(2)}
                    </span>
                    <span className="text-2xl sm:text-3xl font-extrabold text-muted-foreground">
                      MAD
                    </span>
                  </div>
                </div>

                {/* Sub-KPIs in Hero */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-5 border-t border-emerald-500/20 max-w-2xl">
                  <div>
                    <span className="text-xs text-muted-foreground font-semibold block">Tickets / Ventes</span>
                    <span className="text-2xl font-black text-foreground">{caisseStats.countTotal}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground font-semibold block">Panier Moyen</span>
                    <span className="text-2xl font-black text-foreground">
                      {caisseStats.panierMoyen.toFixed(2)} <span className="text-xs font-semibold text-muted-foreground">MAD</span>
                    </span>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-xs text-muted-foreground font-semibold block">Dernier Ticket</span>
                    <span className="text-base font-bold text-foreground">
                      {todayVentes[0]?.created_at
                        ? new Date(todayVentes[0].created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ================================================================= */}
            {/* PAYMENT METHOD BREAKDOWN CARDS */}
            {/* ================================================================= */}
            <div className="shrink-0 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Espèces */}
              <Card className="rounded-2xl border-border/70 p-5 bg-card hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                    <Banknote className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="text-xs font-bold border-emerald-500/30 text-emerald-600">
                    {caisseStats.totalJour > 0 ? ((caisseStats.totalEspeces / caisseStats.totalJour) * 100).toFixed(0) : 0}%
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Espèces en Caisse</p>
                <p className="text-2xl sm:text-3xl font-black text-foreground mt-1">
                  {caisseStats.totalEspeces.toFixed(2)} <span className="text-xs font-semibold text-muted-foreground">MAD</span>
                </p>
                <p className="text-xs text-muted-foreground mt-2 font-medium">
                  {caisseStats.countEspeces} transactions
                </p>
              </Card>

              {/* Carte Bancaire */}
              <Card className="rounded-2xl border-border/70 p-5 bg-card hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="text-xs font-bold border-blue-500/30 text-blue-600">
                    {caisseStats.totalJour > 0 ? ((caisseStats.totalCarte / caisseStats.totalJour) * 100).toFixed(0) : 0}%
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Carte Bancaire (TPE)</p>
                <p className="text-2xl sm:text-3xl font-black text-foreground mt-1">
                  {caisseStats.totalCarte.toFixed(2)} <span className="text-xs font-semibold text-muted-foreground">MAD</span>
                </p>
                <p className="text-xs text-muted-foreground mt-2 font-medium">
                  {caisseStats.countCarte} transactions
                </p>
              </Card>

              {/* Chèques */}
              <Card className="rounded-2xl border-border/70 p-5 bg-card hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold">
                    <FileCheck2 className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="text-xs font-bold border-purple-500/30 text-purple-600">
                    {caisseStats.totalJour > 0 ? ((caisseStats.totalCheque / caisseStats.totalJour) * 100).toFixed(0) : 0}%
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Chèques</p>
                <p className="text-2xl sm:text-3xl font-black text-foreground mt-1">
                  {caisseStats.totalCheque.toFixed(2)} <span className="text-xs font-semibold text-muted-foreground">MAD</span>
                </p>
                <p className="text-xs text-muted-foreground mt-2 font-medium">
                  {caisseStats.countCheque} transactions
                </p>
              </Card>

              {/* Virements */}
              <Card className="rounded-2xl border-border/70 p-5 bg-card hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                    <ArrowUpRight className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="text-xs font-bold border-amber-500/30 text-amber-600">
                    {caisseStats.totalJour > 0 ? ((caisseStats.totalVirement / caisseStats.totalJour) * 100).toFixed(0) : 0}%
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Virements</p>
                <p className="text-2xl sm:text-3xl font-black text-foreground mt-1">
                  {caisseStats.totalVirement.toFixed(2)} <span className="text-xs font-semibold text-muted-foreground">MAD</span>
                </p>
                <p className="text-xs text-muted-foreground mt-2 font-medium">
                  Direct compte
                </p>
              </Card>
            </div>

            {/* Today's Transactions Table */}
            <Card className="shrink-0 rounded-3xl border-border/70 shadow-xs overflow-hidden">
              <CardHeader className="border-b bg-muted/20 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-black">Ventes Réalisées Aujourd&apos;hui</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Liste chronologique des tickets enregistrés ce jour
                    </p>
                  </div>
                  <span className="text-xs font-bold text-muted-foreground">
                    {todayVentes.length} tickets
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {todayVentes.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <ReceiptText className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="font-semibold text-sm">Aucune vente enregistrée aujourd&apos;hui</p>
                    <p className="text-xs mt-1">Passez au POS pour commencer à encaisser.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {todayVentes.map((v) => (
                      <div
                        key={v.id}
                        className="p-4 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-black text-sm text-foreground">{v.numero}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {modeLabels[v.mode_paiement] || v.mode_paiement}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {v.client?.raison_sociale || "Comptoir"}
                          </span>
                        </div>

                        <div className="flex items-center gap-4">
                          <span className="text-xs text-muted-foreground">
                            {v.created_at
                              ? new Date(v.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
                              : "—"}
                          </span>
                          <span className="font-extrabold text-sm text-foreground">
                            {Number(v.montant_ttc).toFixed(2)} MAD
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedSaleDetail(v)}
                            className="h-7 text-xs px-2.5 rounded-lg"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            Détail
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* 2.5 MODAL DE PAIEMENT & ENCAISSEMENT */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 2.5 MODAL DE PAIEMENT & ENCAISSEMENT */}
      {/* ========================================================================= */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="w-[96vw] max-w-[96vw] sm:max-w-xl md:max-w-2xl p-4 sm:p-6 rounded-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden flex flex-col gap-4"
        >
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-lg sm:text-xl font-black flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary shrink-0" />
              <span>Paiement & Encaissement</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Sélectionnez le mode de règlement et confirmez la vente
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 sm:space-y-4 pt-1">
            {/* Grand Total Highlight Card */}
            <div className="rounded-2xl p-3.5 sm:p-5 bg-muted/40 border border-border/80 text-center space-y-1.5 shadow-xs">
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                Montant Total à Payer
              </span>
              <div className="text-3xl sm:text-4xl md:text-5xl font-black text-primary tracking-tight">
                {effectiveRemise > 0 ? (
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-2 mb-1 flex-wrap justify-center">
                      <span className="line-through text-muted-foreground text-sm sm:text-lg font-semibold">
                        {totalTTC.toFixed(2)} MAD
                      </span>
                      <span className="text-amber-600 dark:text-amber-400 text-[11px] sm:text-xs font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                        -{effectiveRemise.toFixed(2)} MAD ({Math.round((effectiveRemise / totalTTC) * 100)}%)
                      </span>
                    </div>
                    <div>
                      {effectiveFinalPrice.toFixed(2)}{" "}
                      <span className="text-lg sm:text-2xl font-bold text-muted-foreground">MAD</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    {totalTTC.toFixed(2)}{" "}
                    <span className="text-lg sm:text-2xl font-bold text-muted-foreground">MAD</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-center gap-2 text-[11px] sm:text-xs text-muted-foreground pt-1 flex-wrap">
                <span className="bg-background/80 px-2.5 py-0.5 rounded-full border border-border/60">
                  Client : <strong className="text-foreground">{clientId === "comptoir" ? "Comptoir" : clients?.find((c) => c.id === clientId)?.raison_sociale || "Client"}</strong>
                </span>
                <span className="bg-background/80 px-2.5 py-0.5 rounded-full border border-border/60">
                  Caisse : <strong className="text-foreground">{tresoreries?.find((t) => t.id === tresorerieId)?.libelle || "Caisse"}</strong>
                </span>
              </div>
            </div>

            {/* Mode de règlement buttons */}
            <div>
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                Mode de règlement
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: "especes", label: "Espèces", icon: Banknote },
                  { id: "carte", label: "Carte Bancaire", icon: CreditCard },
                  { id: "cheque", label: "Chèque", icon: FileCheck2 },
                  { id: "virement", label: "Virement", icon: ArrowUpRight },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setModePaiement(mode.id as any)}
                    className={cn(
                      "flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-2xl text-xs font-bold border transition-all cursor-pointer select-none min-h-[60px] sm:min-h-[70px]",
                      modePaiement === mode.id
                        ? "bg-primary text-primary-foreground border-primary shadow-md scale-[1.02]"
                        : "bg-card border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <mode.icon className="h-5 w-5 mb-1 shrink-0" />
                    <span className="text-[11px] leading-tight font-extrabold text-center">{mode.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Articles du Panier & Modification Prix par Article */}
            <div className="space-y-2.5 p-3 sm:p-4 rounded-2xl bg-card border border-border/70">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <ShoppingBag className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground truncate">
                    Articles & Prix Unitaire (Modifiable)
                  </span>
                </div>
                <span className="text-[11px] font-bold text-muted-foreground shrink-0 ml-2">
                  {cart.length} ligne(s)
                </span>
              </div>

              <div className="divide-y divide-border/50 max-h-48 overflow-y-auto pr-1 space-y-1">
                {cart.map((item) => {
                  const isModified = item.prix_initial !== undefined && Math.abs(item.prix_unitaire - item.prix_initial) > 0.001
                  return (
                    <div
                      key={item.article_id}
                      className="pt-2 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2.5 text-xs"
                    >
                      {/* Titre & Quantité */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-xs truncate text-foreground" title={item.designation}>
                            {item.designation}
                          </p>
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-bold shrink-0">
                            ×{item.quantite}
                          </Badge>
                        </div>
                        {isModified && item.prix_initial !== undefined && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-muted-foreground line-through">
                              Base: {item.prix_initial.toFixed(2)} MAD
                            </span>
                            <button
                              type="button"
                              onClick={() => updateUnitPrice(item.article_id, item.prix_initial!)}
                              className="text-[10px] font-bold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                              title="Rétablir le prix initial du catalogue"
                            >
                              <RotateCcw className="h-2.5 w-2.5" />
                              Rétablir
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Inputs Prix Unitaire & Total Ligne */}
                      <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-0.5 sm:pt-0">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground font-semibold">P.U:</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.prix_unitaire}
                            onChange={(e) => updateUnitPrice(item.article_id, parseFloat(e.target.value))}
                            className={cn(
                              "h-7 sm:h-8 w-20 sm:w-24 text-right text-xs font-black rounded-lg px-2",
                              isModified && "border-amber-500/60 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-extrabold"
                            )}
                          />
                          <span className="text-[10px] font-bold text-muted-foreground">MAD</span>
                        </div>

                        <div className="w-20 text-right font-black text-xs text-foreground shrink-0">
                          {(item.prix_unitaire * item.quantite).toFixed(2)}{" "}
                          <span className="text-[9px] text-muted-foreground font-normal">MAD</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Réduction / Prix Négocié */}
            <div className="space-y-3 p-3 sm:p-4 rounded-2xl bg-card border border-border/70">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Réduction / Prix Négocié
                  </span>
                </div>
                {/* Boutons rapides pour mobile & PC */}
                <div className="flex items-center gap-1 flex-wrap">
                  {[5, 10, 20].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => applyQuickDiscountPercent(pct)}
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border/60 transition-colors cursor-pointer"
                    >
                      -{pct}%
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={applyRoundDiscount}
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border/60 transition-colors cursor-pointer"
                    title="Arrondir à la dizaine inférieure"
                  >
                    Arrondi
                  </button>
                  {(customFinalPrice || remiseValue) && (
                    <button
                      type="button"
                      onClick={() => applyQuickDiscountPercent(0)}
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-md text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Prix Final (MAD)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={totalTTC.toFixed(2)}
                    value={customFinalPrice}
                    onChange={(e) => handleFinalPriceChange(e.target.value)}
                    className="h-10 text-base font-black rounded-xl"
                  />
                  <span className="text-[10px] text-muted-foreground block mt-1">
                    Initial : {totalTTC.toFixed(2)} MAD
                  </span>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Montant Réduction (MAD)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={remiseValue}
                    onChange={(e) => handleRemiseChange(e.target.value)}
                    className={cn(
                      "h-10 text-base font-black rounded-xl",
                      effectiveRemise > 0 && "text-amber-600 dark:text-amber-400 font-black border-amber-500/40 bg-amber-500/5"
                    )}
                  />
                  <span className="text-[10px] text-muted-foreground block mt-1">
                    {effectiveRemise > 0 ? `Économie de ${effectiveRemise.toFixed(2)} MAD` : "Aucune réduction"}
                  </span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2.5 pt-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="flex-1 sm:flex-none sm:w-28 h-11 sm:h-12 rounded-xl text-xs sm:text-sm font-bold cursor-pointer"
              >
                Retour
              </Button>
              <Button
                type="button"
                size="lg"
                disabled={createVente.isPending || effectiveFinalPrice < 0}
                onClick={handleFinalize}
                className="flex-[2] sm:flex-1 h-11 sm:h-12 rounded-xl text-xs sm:text-sm font-extrabold gap-2 shadow-lg shadow-primary/25 cursor-pointer px-3 sm:px-6"
              >
                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                <span className="truncate">
                  {createVente.isPending ? "Enregistrement..." : "Confirmer l'Encaissement"}
                </span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 3. RECEIPT TICKET MODAL (AFTER SALE OR INSPECT) */}
      {/* ========================================================================= */}
      <Dialog open={receiptModalOpen} onOpenChange={setReceiptModalOpen}>
        <DialogContent className="max-w-md p-6 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-center font-black text-xl">Ticket de Caisse</DialogTitle>
            <DialogDescription className="text-center text-xs">
              Vente enregistrée avec succès
            </DialogDescription>
          </DialogHeader>

          {completedSale && (
            <div className="space-y-4 pt-2 font-mono text-xs">
              {/* Thermal ticket visual preview */}
              <div className="border border-dashed border-border/80 p-4 rounded-2xl bg-muted/20 space-y-3">
                <div className="text-center border-b border-dashed pb-3">
                  <h4 className="font-black text-base font-sans tracking-wide uppercase">{companySettings?.nom || "LINVENTORY"}</h4>
                  {companySettings?.adresse && <p className="text-[10px] text-muted-foreground">{companySettings.adresse}</p>}
                  {companySettings?.telephone && <p className="text-[10px] text-muted-foreground">Tél: {companySettings.telephone}</p>}
                  {companySettings?.ice && <p className="text-[10px] text-muted-foreground">ICE: {companySettings.ice}</p>}
                  <p className="text-[11px] font-bold text-foreground mt-1">Ticket : {completedSale.numero}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(completedSale.date).toLocaleDateString("fr-FR")} à{" "}
                    {new Date(completedSale.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>

                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Client :</span>
                    <span className="font-bold">{completedSale.clientName}</span>
                  </div>
                  {completedSale.cashierName && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Caissier :</span>
                      <span className="font-bold">{completedSale.cashierName}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Règlement :</span>
                    <span className="font-bold">{modeLabels[completedSale.mode_paiement] || completedSale.mode_paiement}</span>
                  </div>
                </div>

                {/* Items Breakdown */}
                <div className="border-t border-b border-dashed py-2.5 space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase text-muted-foreground pb-1 border-b border-dashed">
                    <span>Désignation</span>
                    <span className="text-center">Qté x P.U</span>
                    <span className="text-right">Total</span>
                  </div>
                  {completedSale.lignes?.map((l: any, idx: number) => (
                    <div key={idx} className="space-y-0.5 text-xs">
                      <div className="font-bold truncate text-foreground">{l.designation}</div>
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>
                          {l.quantite} x {Number(l.prix_unitaire).toFixed(2)} DH
                        </span>
                        <span className="font-bold text-foreground">
                          {(Number(l.quantite) * Number(l.prix_unitaire)).toFixed(2)} DH
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="space-y-1.5 pt-1">
                  {completedSale.remise > 0 && (
                    <>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Sous-Total initial :</span>
                        <span>{(Number(completedSale.montant_ttc) + Number(completedSale.remise)).toFixed(2)} DH</span>
                      </div>
                      <div className="flex justify-between text-xs font-bold text-amber-600 dark:text-amber-400">
                        <span>Réduction / Remise :</span>
                        <span>-{Number(completedSale.remise).toFixed(2)} DH</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-base font-black pt-1 border-t border-dashed">
                    <span>TOTAL PAYÉ</span>
                    <span className="text-primary">{Number(completedSale.montant_ttc).toFixed(2)} DH</span>
                  </div>

                  <div className="flex justify-between text-[10px] text-muted-foreground pt-1">
                    <span>Nombre d&apos;articles :</span>
                    <span className="font-bold">
                      {completedSale.lignes?.reduce((sum: number, l: any) => sum + Number(l.quantite), 0)} article(s)
                    </span>
                  </div>
                </div>

                <div className="text-center text-[10px] text-muted-foreground pt-2 border-t border-dashed">
                  <div className="font-mono text-xs tracking-widest font-black opacity-80 mb-1">
                    *{completedSale.numero.replace(/[^A-Z0-9]/gi, "")}*
                  </div>
                  Merci de votre visite et à bientôt !
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl gap-2 text-xs font-bold"
                  onClick={() =>
                    printPosTicket({
                      ticketNumero: completedSale.numero,
                      date: completedSale.date,
                      caissier: completedSale.cashierName,
                      client: completedSale.clientName,
                      modePaiement: modeLabels[completedSale.mode_paiement] || completedSale.mode_paiement,
                      lignes: completedSale.lignes.map((l: any) => ({
                        designation: l.designation,
                        quantite: Number(l.quantite),
                        prix_unitaire: Number(l.prix_unitaire),
                        montant_total: Number(l.quantite) * Number(l.prix_unitaire),
                      })),
                      totalInitial: completedSale.totalInitial || (completedSale.remise > 0 ? Number(completedSale.montant_ttc) + Number(completedSale.remise) : undefined),
                      remise: completedSale.remise || undefined,
                      totalTTC: completedSale.montant_ttc,
                    })
                  }
                >
                  <Printer className="h-4 w-4 text-orange-600" />
                  Imprimer Ticket POS
                </Button>
                <Button className="flex-1 rounded-xl text-xs font-bold" onClick={() => setReceiptModalOpen(false)}>
                  Nouvelle Vente
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 3.5 RETOUR DE VENTE MODAL (ONLY SOLD ARTICLES + BARCODE SCANNER) */}
      {/* ========================================================================= */}
      <Dialog open={retourModalOpen} onOpenChange={setRetourModalOpen}>
        <DialogContent className="max-w-3xl p-4 sm:p-6 rounded-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <RotateCcw className="h-5 w-5" />
              <span>Retour de Vente & Remboursement</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Scannez le code-barres ou recherchez un article déjà vendu pour réintégrer le stock et rembourser le client.
            </DialogDescription>
          </DialogHeader>

          {/* Barcode & Search Input Bar */}
          <div className="space-y-3 pt-1">
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Scanner le code-barres ou saisir le nom, code, N° ticket..."
                  value={retourSearch}
                  onChange={(e) => setRetourSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && retourSearch.trim()) {
                      handleRetourBarcodeScanned(retourSearch.trim())
                    }
                  }}
                  className="pl-9 h-11 rounded-xl text-xs sm:text-sm font-medium bg-muted/40"
                  autoFocus
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsScanningRetour(!isScanningRetour)}
                className={cn(
                  "h-11 px-3 rounded-xl gap-1.5 font-bold text-xs shrink-0 cursor-pointer",
                  isScanningRetour && "bg-rose-500 text-white border-rose-500"
                )}
                title="Activer la caméra pour scanner le code-barres"
              >
                <Scan className="h-4 w-4" />
                <span className="hidden sm:inline">Caméra</span>
              </Button>
            </div>

            {/* Camera Barcode Scanner View */}
            {isScanningRetour && (
              <div className="p-3 border rounded-2xl bg-card">
                <BarcodeScanner
                  onScan={handleRetourBarcodeScanned}
                  onClose={() => setIsScanningRetour(false)}
                />
              </div>
            )}

            {/* Main Layout: Left = Sold items list, Right = Return details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* Left: Sold Articles list */}
              <div className="space-y-2 border rounded-2xl p-3 bg-muted/20 flex flex-col">
                <div className="flex items-center justify-between pb-1 border-b border-border/60">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Articles Vendus ({filteredSoldArticles.length})
                  </span>
                  {soldArticles && soldArticles.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      Cliquez pour sélectionner
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {isSoldArticlesLoading ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      Chargement de l&apos;historique des ventes...
                    </div>
                  ) : filteredSoldArticles.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground space-y-1">
                      <Package className="h-8 w-8 mx-auto text-muted-foreground/40 mb-1" />
                      <p className="font-semibold">Aucun article vendu trouvé</p>
                      <p className="text-[11px] text-muted-foreground">
                        {retourSearch ? "Essayez un autre mot-clé ou code-barres" : "Aucune vente enregistrée pour le moment"}
                      </p>
                    </div>
                  ) : (
                    filteredSoldArticles.map((item) => {
                      const isSelected = selectedSoldArticle?.article_id === item.article_id
                      return (
                        <div
                          key={item.article_id}
                          onClick={() => {
                            setSelectedSoldArticle(item)
                            setRetourQuantity(1)
                            setRetourPrice(
                              (item.ventes_recents[0]?.prix_unitaire || item.prix_vente).toFixed(2)
                            )
                          }}
                          className={cn(
                            "p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between gap-2",
                            isSelected
                              ? "bg-rose-500/10 border-rose-500/50 shadow-xs ring-1 ring-rose-500/30"
                              : "bg-card border-border/70 hover:bg-muted/60"
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-bold truncate text-foreground">{item.designation}</p>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                              <span>Réf: {item.code}</span>
                              {item.code_barre && <span>• CB: {item.code_barre}</span>}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              Dernière vente : {item.ventes_recents[0]?.numero || "POS"} ({new Date(item.ventes_recents[0]?.date || Date.now()).toLocaleDateString("fr-FR")})
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <Badge variant="outline" className="text-[10px] font-bold text-rose-600 bg-rose-500/10 border-rose-500/30">
                              Vendu: {item.quantite_vendue}
                            </Badge>
                            <p className="font-black text-xs text-foreground mt-1">
                              {item.prix_vente.toFixed(2)} MAD
                            </p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Right: Selected Return Configuration */}
              <div className="space-y-3 border rounded-2xl p-3.5 bg-card flex flex-col justify-between">
                {!selectedSoldArticle ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                    <Undo2 className="h-10 w-10 text-muted-foreground/30 mb-2" />
                    <p className="font-bold text-xs text-foreground">Sélectionnez un article</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[200px]">
                      Scannez le code-barres ou cliquez sur un produit vendu dans la liste de gauche.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 text-xs">
                    {/* Selected product card header */}
                    <div className="p-3 bg-muted/40 rounded-xl border space-y-1">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold uppercase text-muted-foreground">Article sélectionné</span>
                        <Badge variant="secondary" className="text-[10px] font-bold">
                          Max à retourner : {selectedSoldArticle.quantite_vendue}
                        </Badge>
                      </div>
                      <p className="font-bold text-sm text-foreground leading-snug">
                        {selectedSoldArticle.designation}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Code : {selectedSoldArticle.code} {selectedSoldArticle.code_barre ? `• Code-barres : ${selectedSoldArticle.code_barre}` : ""}
                      </p>
                    </div>

                    {/* Quantity & Unit price row */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                          Quantité à retourner
                        </label>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setRetourQuantity(Math.max(1, retourQuantity - 1))}
                            className="h-9 w-9 rounded-lg shrink-0"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                          <Input
                            type="number"
                            min="1"
                            max={selectedSoldArticle.quantite_vendue}
                            value={retourQuantity}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 1
                              setRetourQuantity(Math.min(selectedSoldArticle.quantite_vendue, Math.max(1, val)))
                            }}
                            className="h-9 text-center font-black rounded-lg text-sm"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setRetourQuantity(Math.min(selectedSoldArticle.quantite_vendue, retourQuantity + 1))}
                            className="h-9 w-9 rounded-lg shrink-0"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                          Prix de reprise (MAD)
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          value={retourPrice}
                          onChange={(e) => setRetourPrice(e.target.value)}
                          placeholder={selectedSoldArticle.prix_vente.toFixed(2)}
                          className="h-9 font-black rounded-lg text-sm"
                        />
                      </div>
                    </div>

                    {/* Mode de remboursement */}
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                        Mode de Remboursement
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { id: "especes", label: "Espèces" },
                          { id: "carte", label: "Carte" },
                          { id: "cheque", label: "Chèque" },
                          { id: "virement", label: "Virement" },
                        ].map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setRetourModePaiement(m.id as any)}
                            className={cn(
                              "py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all select-none cursor-pointer text-center",
                              retourModePaiement === m.id
                                ? "bg-rose-500 text-white border-rose-500 shadow-xs"
                                : "bg-muted/40 border-border/70 text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Dépôt & Caisse */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                          Réintégrer au dépôt
                        </label>
                        <Select value={retourDepotId || depotId} onValueChange={setRetourDepotId}>
                          <SelectTrigger className="h-8 rounded-lg text-[11px]">
                            <SelectValue placeholder="Dépôt" />
                          </SelectTrigger>
                          <SelectContent>
                            {depots?.map((d) => (
                              <SelectItem key={d.id} value={d.id} className="text-xs">
                                {d.libelle}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                          Décaisser de la caisse
                        </label>
                        <Select value={retourTresorerieId || tresorerieId} onValueChange={setRetourTresorerieId}>
                          <SelectTrigger className="h-8 rounded-lg text-[11px]">
                            <SelectValue placeholder="Caisse" />
                          </SelectTrigger>
                          <SelectContent>
                            {tresoreries?.map((t) => (
                              <SelectItem key={t.id} value={t.id} className="text-xs">
                                {t.libelle}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Motif */}
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                        Motif du retour (Optionnel)
                      </label>
                      <Input
                        placeholder="Ex: Produit défectueux, Erreur de taille..."
                        value={retourMotif}
                        onChange={(e) => setRetourMotif(e.target.value)}
                        className="h-8 rounded-lg text-xs"
                      />
                    </div>

                    {/* Total Refund Banner */}
                    <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider">
                        Montant à rembourser
                      </span>
                      <span className="text-lg font-black text-rose-600 dark:text-rose-400">
                        {(Number(retourQuantity) * (parseFloat(retourPrice) || selectedSoldArticle.prix_vente)).toFixed(2)} MAD
                      </span>
                    </div>
                  </div>
                )}

                {/* Footer Buttons */}
                <div className="flex gap-2 pt-2 border-t mt-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setRetourModalOpen(false)}
                    className="flex-1 h-10 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Annuler
                  </Button>
                  <Button
                    type="button"
                    disabled={!selectedSoldArticle || createRetour.isPending}
                    onClick={handleConfirmRetour}
                    className="flex-[2] h-10 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/25 cursor-pointer gap-1.5"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>{createRetour.isPending ? "Validation..." : "Valider le Retour"}</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 3.6 RETOUR RECEIPT MODAL (TICKET DE RETOUR / AVOIR) */}
      {/* ========================================================================= */}
      <Dialog open={retourReceiptModalOpen} onOpenChange={setRetourReceiptModalOpen}>
        <DialogContent className="max-w-md p-6 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-center font-black text-xl text-rose-600 dark:text-rose-400">
              Ticket de Retour / Avoir
            </DialogTitle>
            <DialogDescription className="text-center text-xs">
              Retour validé et stock réintégré avec succès
            </DialogDescription>
          </DialogHeader>

          {completedRetour && (
            <div className="space-y-4 pt-2 font-mono text-xs">
              <div className="border border-dashed border-border/80 p-4 rounded-2xl bg-muted/20 space-y-3">
                <div className="text-center border-b border-dashed pb-3">
                  <h4 className="font-black text-base font-sans tracking-wide uppercase">{companySettings?.nom || "LINVENTORY"}</h4>
                  {companySettings?.adresse && <p className="text-[10px] text-muted-foreground">{companySettings.adresse}</p>}
                  <Badge variant="outline" className="my-1 font-black border-rose-500/40 text-rose-600 bg-rose-500/10">
                    TICKET DE RETOUR / AVOIR
                  </Badge>
                  <p className="text-[11px] font-bold text-foreground mt-0.5">N° : {completedRetour.numero}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(completedRetour.date).toLocaleDateString("fr-FR")} à{" "}
                    {new Date(completedRetour.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>

                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Caissier :</span>
                    <span className="font-bold">{completedRetour.cashierName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Règlement :</span>
                    <span className="font-bold">{completedRetour.mode_remboursement}</span>
                  </div>
                  {completedRetour.motif && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Motif :</span>
                      <span className="font-bold">{completedRetour.motif}</span>
                    </div>
                  )}
                </div>

                {/* Items Breakdown */}
                <div className="border-t border-b border-dashed py-2.5 space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase text-muted-foreground pb-1 border-b border-dashed">
                    <span>Article retourné</span>
                    <span className="text-center">Qté x P.U</span>
                    <span className="text-right">Total</span>
                  </div>
                  {completedRetour.lignes?.map((l: any, idx: number) => (
                    <div key={idx} className="space-y-0.5 text-xs">
                      <div className="font-bold truncate text-foreground">{l.designation}</div>
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>
                          {l.quantite} x {Number(l.prix_unitaire).toFixed(2)} DH
                        </span>
                        <span className="font-bold text-rose-600 dark:text-rose-400">
                          {Number(l.montant_total).toFixed(2)} DH
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-base font-black pt-1 border-t border-dashed">
                    <span>TOTAL REMBOURSÉ</span>
                    <span className="text-rose-600 dark:text-rose-400">{Number(completedRetour.montant_total).toFixed(2)} DH</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold pt-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Stock réintégré dans le dépôt sélectionné</span>
                  </div>
                </div>

                <div className="text-center text-[10px] text-muted-foreground pt-2 border-t border-dashed">
                  Merci de votre confiance !
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl gap-2 text-xs font-bold"
                  onClick={() =>
                    printPosRetourTicket({
                      ticketNumero: completedRetour.numero,
                      date: completedRetour.date,
                      caissier: completedRetour.cashierName,
                      client: completedRetour.clientName,
                      modeRemboursement: completedRetour.mode_remboursement,
                      motif: completedRetour.motif,
                      lignes: completedRetour.lignes.map((l: any) => ({
                        designation: l.designation,
                        quantite: Number(l.quantite),
                        prix_unitaire: Number(l.prix_unitaire),
                        montant_total: Number(l.montant_total),
                      })),
                      totalRembourse: completedRetour.montant_total,
                    })
                  }
                >
                  <Printer className="h-4 w-4 text-rose-600" />
                  Imprimer Ticket de Retour
                </Button>
                <Button className="flex-1 rounded-xl text-xs font-bold" onClick={() => setRetourReceiptModalOpen(false)}>
                  Fermer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 4. SALE DETAIL MODAL (FROM HISTORIQUE / CAISSE) */}
      {/* ========================================================================= */}
      <Dialog open={!!selectedSaleDetail} onOpenChange={() => setSelectedSaleDetail(null)}>
        <DialogContent className="max-w-lg p-6 rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-black text-xl">Détail du Ticket</DialogTitle>
            <DialogDescription className="text-xs">
              Vente N° {selectedSaleDetail?.numero}
            </DialogDescription>
          </DialogHeader>

          {selectedSaleDetail && (
            <div className="space-y-4 pt-2 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-muted/30 rounded-2xl border">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Client</span>
                  <span className="font-semibold text-foreground">{selectedSaleDetail.client?.raison_sociale || "Comptoir"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Caissier</span>
                  <span className="font-semibold text-foreground">
                    {[selectedSaleDetail.commercial?.prenom, selectedSaleDetail.commercial?.nom].filter(Boolean).join(" ") ||
                      selectedSaleDetail.commercial?.email ||
                      "—"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Date</span>
                  <span className="font-semibold text-foreground">
                    {new Date(selectedSaleDetail.date).toLocaleDateString("fr-FR")}
                    {selectedSaleDetail.created_at &&
                      ` à ${new Date(selectedSaleDetail.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Règlement</span>
                  <Badge variant="outline" className="mt-0.5 font-bold text-[10px]">
                    {modeLabels[selectedSaleDetail.mode_paiement] || selectedSaleDetail.mode_paiement}
                  </Badge>
                </div>
                {Number(selectedSaleDetail.remise || 0) > 0 && (
                  <>
                    <div className="col-span-2 pt-2 border-t flex justify-between items-baseline text-muted-foreground text-xs">
                      <span>Sous-Total initial</span>
                      <span>{(Number(selectedSaleDetail.montant_ttc) + Number(selectedSaleDetail.remise)).toFixed(2)} MAD</span>
                    </div>
                    <div className="col-span-2 flex justify-between items-baseline text-amber-600 dark:text-amber-400 font-bold text-xs">
                      <span>Réduction / Remise</span>
                      <span>-{Number(selectedSaleDetail.remise).toFixed(2)} MAD</span>
                    </div>
                  </>
                )}
                <div className="col-span-2 pt-2 border-t flex justify-between items-baseline">
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Total Encaissé</span>
                  <span className="font-black text-xl text-primary">
                    {Number(selectedSaleDetail.montant_ttc).toFixed(2)} MAD
                  </span>
                </div>
              </div>

              {/* Items Breakdown Table */}
              <div className="rounded-2xl border overflow-hidden">
                <div className="bg-muted/40 p-2.5 font-bold text-xs border-b">
                  Articles de la commande ({selectedSaleDetail.lignes?.length || 0})
                </div>
                <div className="divide-y divide-border/60 max-h-56 overflow-y-auto">
                  {selectedSaleDetail.lignes?.map((l: any, idx: number) => (
                    <div key={idx} className="p-2.5 flex justify-between items-center text-xs">
                      <div>
                        <p className="font-semibold text-foreground">{l.designation}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {l.quantite} x {Number(l.prix_unitaire).toFixed(2)} MAD
                        </p>
                      </div>
                      <span className="font-bold">
                        {(Number(l.quantite) * Number(l.prix_unitaire)).toFixed(2)} MAD
                      </span>
                    </div>
                  ))}
                  {(!selectedSaleDetail.lignes || selectedSaleDetail.lignes.length === 0) && (
                    <div className="p-4 text-center text-muted-foreground text-xs">
                      Aucune ligne détaillée enregistrée.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const cashierName =
                      [selectedSaleDetail.commercial?.prenom, selectedSaleDetail.commercial?.nom].filter(Boolean).join(" ") ||
                      selectedSaleDetail.commercial?.full_name ||
                      selectedSaleDetail.commercial?.email?.split("@")[0] ||
                      "Caissier"
                    printPosTicket({
                      ticketNumero: selectedSaleDetail.numero,
                      date: selectedSaleDetail.date,
                      caissier: cashierName,
                      client: selectedSaleDetail.client?.raison_sociale || "Comptoir",
                      modePaiement: modeLabels[selectedSaleDetail.mode_paiement] || selectedSaleDetail.mode_paiement,
                      lignes: (selectedSaleDetail.lignes || []).map((l: any) => ({
                        designation: l.designation,
                        quantite: Number(l.quantite),
                        prix_unitaire: Number(l.prix_unitaire),
                        montant_total: Number(l.quantite) * Number(l.prix_unitaire),
                      })),
                      totalInitial: Number(selectedSaleDetail.remise || 0) > 0 ? Number(selectedSaleDetail.montant_ttc) + Number(selectedSaleDetail.remise) : undefined,
                      remise: Number(selectedSaleDetail.remise || 0) > 0 ? Number(selectedSaleDetail.remise) : undefined,
                      totalTTC: Number(selectedSaleDetail.montant_ttc),
                    })
                  }}
                  className="rounded-xl gap-2 text-xs font-bold"
                >
                  <Printer className="h-4 w-4 text-orange-600" />
                  Imprimer Ticket POS
                </Button>
                <Button onClick={() => setSelectedSaleDetail(null)} className="rounded-xl text-xs font-bold">
                  Fermer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 5. TICKET CLÔTURE DE CAISSE / FERMETURE DE COMPTES PAR CAISSIER */}
      {/* ========================================================================= */}
      <Dialog open={posClotureModalOpen} onOpenChange={setPosClotureModalOpen}>
        <DialogContent className="max-w-lg p-6 rounded-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-black text-xl text-center">Bilan & Clôture de Caisse</DialogTitle>
            <DialogDescription className="text-center text-xs">
              Récapitulatif pour clôturer et fermer les comptes avec desglose d&apos;articles et vendeurs
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2 font-mono text-xs">
            {/* Printable Thermal Receipt Style */}
            <div className="border border-dashed p-4 rounded-2xl bg-muted/20 space-y-3 print:border-none print:p-0">
              <div className="text-center border-b border-dashed pb-3 font-sans">
                <h3 className="font-black text-base tracking-tight uppercase">{companySettings?.nom || "LINVENTORY"} POS</h3>
                <p className="text-[11px] font-bold text-muted-foreground uppercase mt-0.5">
                  TICKET DE CLÔTURE / FERMETURE DE SESSION
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Imprimé le {new Date().toLocaleDateString("fr-FR")} à{" "}
                  {new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>

              {/* Caissier & Date */}
              <div className="space-y-1 text-[11px] pb-2 border-b border-dashed">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Caissier / Filtre :</span>
                  <span className="font-bold text-foreground">{posActiveCashierName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Période :</span>
                  <span className="font-bold text-foreground">{posActivePeriodLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nombre de Ventes :</span>
                  <span className="font-black text-foreground">{historiqueKpis.count} tickets</span>
                </div>
              </div>

              {/* Détail Modes de Règlement */}
              <div className="space-y-1.5 py-2 border-b border-dashed">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  1. Détail par Mode de Règlement
                </span>
                <div className="flex justify-between items-center text-xs">
                  <span>💵 Espèces en Caisse ({historiqueKpis.countEspeces})</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {historiqueKpis.totalEspeces.toFixed(2)} MAD
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span>💳 Carte Bancaire TPE ({historiqueKpis.countCarte})</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {historiqueKpis.totalCarte.toFixed(2)} MAD
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span>📝 Chèques ({historiqueKpis.countCheque})</span>
                  <span className="font-bold">
                    {historiqueKpis.totalCheque.toFixed(2)} MAD
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span>🏦 Virements ({historiqueKpis.countVirement})</span>
                  <span className="font-bold">
                    {historiqueKpis.totalVirement.toFixed(2)} MAD
                  </span>
                </div>
                <div className="flex justify-between items-baseline text-sm font-black pt-1.5 border-t border-dashed">
                  <span>TOTAL GÉNÉRAL ENCAISSÉ :</span>
                  <span className="text-primary font-black">
                    {historiqueKpis.total.toFixed(2)} MAD
                  </span>
                </div>
              </div>

              {/* NOUVEAU: Ventes par Vendeur (Utilisateur) */}
              <div className="space-y-2 py-2 border-b border-dashed">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  2. Ventes par Vendeur (Utilisateur)
                </span>
                {clotureArticlesData.articlesGroupedByUser.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground italic">Aucune vente enregistrée.</p>
                ) : (
                  clotureArticlesData.articlesGroupedByUser.map((u, idx) => (
                    <div key={idx} className="bg-background/80 rounded-xl p-2.5 border space-y-1.5">
                      <div className="flex justify-between items-center font-bold text-xs text-foreground border-b pb-1">
                        <span className="flex items-center gap-1">
                          👤 <span>{u.userName}</span>
                        </span>
                        <span className="text-primary">{u.totalMontant.toFixed(2)} MAD</span>
                      </div>
                      <div className="space-y-1 pl-1">
                        {u.articles.map((art, aIdx) => (
                          <div key={aIdx} className="flex justify-between text-[10px] text-muted-foreground">
                            <span className="truncate max-w-[200px]">• {art.designation} (x{art.quantite})</span>
                            <span className="font-semibold text-foreground">{art.total.toFixed(2)} MAD</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* NOUVEAU: Récapitulatif Global des Articles Vendus */}
              <div className="space-y-2 py-2 border-b border-dashed">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  3. Récapitulatif Global des Articles Vendus ({clotureArticlesData.articlesSummary.length})
                </span>
                <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                  <div className="flex justify-between text-[9px] font-bold uppercase text-muted-foreground border-b pb-1">
                    <span>Article</span>
                    <span>Qté</span>
                    <span>Total</span>
                    <span>Vendeur(s)</span>
                  </div>
                  {clotureArticlesData.articlesSummary.map((art, idx) => (
                    <div key={idx} className="flex justify-between text-[10px] py-0.5 border-b border-dashed/40">
                      <span className="font-semibold truncate max-w-[140px]">{art.designation}</span>
                      <span className="font-black text-center w-8">x{art.quantite}</span>
                      <span className="font-bold text-right w-16">{art.total.toFixed(2)}</span>
                      <span className="text-[9px] text-muted-foreground text-right truncate max-w-[80px]">{art.vendeur}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-black text-[11px] pt-1 border-t">
                    <span>Total Quantités Vendues :</span>
                    <span>
                      {clotureArticlesData.articlesSummary.reduce((sum, a) => sum + a.quantite, 0)} pièces
                    </span>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-2 space-y-6 text-[10px] text-muted-foreground font-sans">
                <div className="flex justify-between pt-2">
                  <div>
                    <p className="font-bold">Signature Caissier :</p>
                    <div className="mt-5 border-b border-muted-foreground/40 w-28"></div>
                  </div>
                  <div>
                    <p className="font-bold text-right">Visa Responsable :</p>
                    <div className="mt-5 border-b border-muted-foreground/40 w-28"></div>
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
                className="flex-1 rounded-xl gap-2 text-xs font-bold"
                onClick={() =>
                  printPosCloture({
                    dateCloture: `${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`,
                    periodeLabel: posActivePeriodLabel,
                    caissier: posActiveCashierName,
                    nombreVentes: historiqueKpis.count,
                    totalGeneral: historiqueKpis.total,
                    modesPaiement: [
                      { label: "Espèces", code: "especes", count: historiqueKpis.countEspeces, total: historiqueKpis.totalEspeces },
                      { label: "Carte Bancaire", code: "carte", count: historiqueKpis.countCarte, total: historiqueKpis.totalCarte },
                      { label: "Chèques", code: "cheque", count: historiqueKpis.countCheque, total: historiqueKpis.totalCheque },
                      { label: "Virements", code: "virement", count: historiqueKpis.countVirement, total: historiqueKpis.totalVirement },
                    ],
                    articlesGroupedByUser: clotureArticlesData.articlesGroupedByUser,
                    articlesSummary: clotureArticlesData.articlesSummary,
                  })
                }
              >
                <Printer className="h-4 w-4 text-orange-600" />
                Imprimer le Ticket
              </Button>
              <Button className="flex-1 rounded-xl text-xs font-bold" onClick={() => setPosClotureModalOpen(false)}>
                Fermer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 6. MODAL SCANNER VISUEL PRODUIT (MOTEUR LOCAL DÉTERMINISTE) */}
      {/* ========================================================================= */}
      <CameraProductScanner
        isOpen={isVisualScanning}
        onClose={() => setIsVisualScanning(false)}
        onProductDetected={(article) => {
          addToCart(article)
          toast.success(`🎯 ${article.designation} ajouté au panier`)
        }}
      />
    </div>
  )
}
