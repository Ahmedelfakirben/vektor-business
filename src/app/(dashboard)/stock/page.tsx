"use client"

import { useState, useMemo } from "react"
import { useStockList } from "@/hooks/use-stock"
import { useDepots } from "@/hooks/use-depots"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
    AlertTriangle, 
    ArrowUpDown, 
    ArrowUp, 
    ArrowDown, 
    DollarSign, 
    Layers, 
    LayoutGrid, 
    Trash2, 
    TrendingDown,
    Package,
    Search
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { LoadingScreen } from "@/components/ui/loading-screen"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useRouter } from "next/navigation"
import { useFiscalMode } from "@/providers/fiscal-mode-context"
import { cn } from "@/lib/utils"
import type { Stock } from "@/types/database"

export default function StockPage() {
    const router = useRouter()
    const { data: stock, isLoading } = useStockList()
    const { data: depots } = useDepots()
    const { fiscalMode } = useFiscalMode()
    
    const [depotFilter, setDepotFilter] = useState<string>("all")
    const [search, setSearch] = useState("")
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({ key: '', direction: null })

    const filtered = useMemo(() => {
        return stock?.filter((s) => {
            if (depotFilter !== "all" && s.depot_id !== depotFilter) return false
            if (search) {
                const searchLower = search.toLowerCase()
                const matchesDesignation = s.article?.designation.toLowerCase().includes(searchLower)
                const matchesCode = s.article?.code.toLowerCase().includes(searchLower)
                const matchesRef = s.article?.reference?.toLowerCase().includes(searchLower)
                if (!matchesDesignation && !matchesCode && !matchesRef) return false
            }
            return true
        }) || []
    }, [stock, depotFilter, search])

    const totalArticles = filtered.length
    const totalStockQty = filtered.reduce((acc, curr) => acc + Number(curr.quantite), 0)
    const totalValuation = filtered.reduce((acc, curr) => acc + (Number(curr.quantite) * Number(curr.article?.prix_achat || 0)), 0)
    const stockAlerts = filtered.filter(s => Number(s.quantite) <= Number(s.article?.seuil_alerte || 0) && Number(s.quantite) > 0).length
    const stockRupture = filtered.filter(s => Number(s.quantite) <= 0).length

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' | null = 'asc'
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc'
        } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = null
        }
        setSortConfig({ key, direction })
    }

    const sortedData = useMemo(() => {
        let items = [...filtered]
        if (sortConfig.direction !== null) {
            items.sort((a, b) => {
                let aValue: any = ""
                let bValue: any = ""

                switch (sortConfig.key) {
                    case 'code': aValue = a.article?.code || ""; bValue = b.article?.code || ""; break;
                    case 'designation': aValue = a.article?.designation || ""; bValue = b.article?.designation || ""; break;
                    case 'depot': aValue = a.depot?.libelle || ""; bValue = b.depot?.libelle || ""; break;
                    case 'quantite': aValue = Number(a.quantite); bValue = Number(b.quantite); break;
                    case 'valuation': aValue = Number(a.quantite) * Number(a.article?.prix_achat || 0); bValue = Number(b.quantite) * Number(b.article?.prix_achat || 0); break;
                }

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
                return 0
            })
        }
        return items
    }, [filtered, sortConfig])

    const handleRowClick = (id: string | undefined) => { if (id) router.push(`/articles/${id}`) }

    const SortIcon = ({ column }: { column: string }) => {
        if (sortConfig.key !== column) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-30" />
        if (sortConfig.direction === 'asc') return <ArrowUp className="ml-1 h-3 w-3 text-orange-600" />
        return <ArrowDown className="ml-1 h-3 w-3 text-orange-600" />
    }

    if (isLoading) return <LoadingScreen />

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                     <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-3xl font-bold tracking-tight">Stock</h2>
                        {fiscalMode && <Badge variant="secondary" className="bg-orange-500 text-white border-none animate-pulse">Mode Fiscal Activé</Badge>}
                    </div>
                    <p className="text-muted-foreground italic">Visibilidad en tiempo real de sus activos comerciales.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Rechercher..." 
                            value={search} 
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 h-10 border-orange-500/20 focus-visible:ring-orange-500"
                        />
                    </div>
                    <Select value={depotFilter} onValueChange={setDepotFilter}>
                        <SelectTrigger className="w-full sm:w-[200px] h-10 border-orange-500/20">
                            <SelectValue placeholder="Tous les dépôts" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tous les dépôts</SelectItem>
                            {depots?.map((d) => (<SelectItem key={d.id} value={d.id}>{d.libelle}</SelectItem>))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-gradient-to-br from-background to-muted/20 border-muted">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Valorisation Totale</CardTitle>
                        <DollarSign className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black italic">{totalValuation.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} <span className="text-xs">DH</span></div>
                        <p className="text-[10px] text-muted-foreground mt-1 font-medium italic">Basé sur le prix d'achat HT</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Quantité Totale</CardTitle>
                        <Layers className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{totalStockQty.toLocaleString()}</div>
                        <p className="text-[10px] text-muted-foreground mt-1 font-medium font-bold italic">{totalArticles} références filtrées</p>
                    </CardContent>
                </Card>
                <Card className={cn(stockAlerts > 0 && "bg-orange-500/5 border-orange-500/20")}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Alertes Stock</CardTitle>
                        <AlertTriangle className={cn("h-4 w-4", stockAlerts > 0 ? "text-orange-600 animate-bounce" : "text-muted-foreground")} />
                    </CardHeader>
                    <CardContent>
                        <div className={cn("text-2xl font-black", stockAlerts > 0 && "text-orange-600")}>{stockAlerts}</div>
                        <p className="text-[10px] text-muted-foreground mt-1 font-medium">Bajo el umbral de seguridad</p>
                    </CardContent>
                </Card>
                <Card className={cn(stockRupture > 0 && "bg-destructive/5 border-destructive/20")}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ruptures</CardTitle>
                        <Trash2 className={cn("h-4 w-4", stockRupture > 0 ? "text-destructive animate-pulse" : "text-muted-foreground")} />
                    </CardHeader>
                    <CardContent>
                        <div className={cn("text-2xl font-black", stockRupture > 0 && "text-destructive")}>{stockRupture}</div>
                        <p className="text-[10px] text-muted-foreground mt-1 font-medium">Sin existencias</p>
                    </CardContent>
                </Card>
            </div>

            {/* List */}
            <Card>
                <CardContent className="p-0">
                    <div className="rounded-md border bg-card shadow-sm">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    <TableHead className="cursor-pointer" onClick={() => handleSort('code')}>
                                        <div className="flex items-center">Article <SortIcon column="code" /></div>
                                    </TableHead>
                                    <TableHead className="cursor-pointer" onClick={() => handleSort('designation')}>
                                        <div className="flex items-center">Désignation & Catégorie <SortIcon column="designation" /></div>
                                    </TableHead>
                                    <TableHead className="cursor-pointer" onClick={() => handleSort('depot')}>
                                        <div className="flex items-center">Dépôt <SortIcon column="depot" /></div>
                                    </TableHead>
                                    <TableHead className="cursor-pointer text-center" onClick={() => handleSort('quantite')}>
                                        <div className="flex items-center justify-center">Stock <SortIcon column="quantite" /></div>
                                    </TableHead>
                                    <TableHead className="cursor-pointer text-right" onClick={() => handleSort('valuation')}>
                                        <div className="flex items-center justify-end">Valuation <SortIcon column="valuation" /></div>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedData.map((s) => {
                                    const qty = Number(s.quantite)
                                    const seuil = Number(s.article?.seuil_alerte || 0)
                                    const isRupture = qty <= 0
                                    const isAlert = qty <= seuil && !isRupture
                                    
                                    return (
                                        <TableRow 
                                            key={s.id} 
                                            className="cursor-pointer hover:bg-orange-500/5 group"
                                            onClick={() => handleRowClick(s.article_id)}
                                        >
                                            <TableCell className="align-middle">
                                                <div className="flex flex-col">
                                                    <span className="font-black text-sm">{s.article?.code}</span>
                                                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">
                                                        {s.article?.reference || "SANS REF"}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="align-middle">
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-semibold text-sm group-hover:text-orange-600 transition-colors">{s.article?.designation}</span>
                                                    <div className="flex items-center gap-1">
                                                        <Badge variant="outline" className="text-[9px] py-0 h-4 bg-muted/40 font-medium">
                                                            {s.article?.famille?.libelle || "No Famille"}
                                                        </Badge>
                                                        {s.article?.sous_famille?.libelle && (
                                                            <Badge variant="outline" className="text-[9px] py-0 h-4 bg-orange-500/5 border-orange-500/20 text-orange-600 font-black">
                                                                {s.article?.sous_famille?.libelle}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="align-middle">
                                                <Badge variant="secondary" className="text-[10px] font-medium bg-blue-500/5 text-blue-600 border-blue-500/10">
                                                    {s.depot?.libelle}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center align-middle">
                                                <div className="flex flex-col items-center gap-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={cn(
                                                            "text-lg font-black tracking-tighter",
                                                            isRupture ? "text-destructive" : isAlert ? "text-orange-600" : "text-green-600"
                                                        )}>
                                                            {qty.toLocaleString()}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground uppercase font-bold">{s.article?.unite}</span>
                                                    </div>
                                                    {isRupture ? (
                                                        <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-[8px] h-3 px-1 uppercase font-black">En Rupture</Badge>
                                                    ) : isAlert ? (
                                                        <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20 text-[8px] h-3 px-1 uppercase font-black">Alerte Seuil</Badge>
                                                    ) : null}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right align-middle">
                                                <div className="flex flex-col">
                                                    <span className="font-black text-foreground/80">
                                                        {(qty * (s.article?.prix_achat || 0)).toLocaleString("fr-FR", { minimumFractionDigits: 2 })}
                                                    </span>
                                                    <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-black">DH</span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                                {sortedData.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                                            Aucun article trouvé dans le stock.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
