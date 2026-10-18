import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Users, Package, FileText, ShoppingCart, 
  TrendingUp, AlertTriangle, Wallet, BarChart3,
  ArrowUpRight, ArrowDownRight, DollarSign, Activity,
  ReceiptText, Globe
} from "lucide-react"
import Link from "next/link"
import { RevenueChart } from "@/components/dashboard/revenue-chart"
import { DistributionCharts } from "@/components/dashboard/distribution-charts"
import { format, subDays } from "date-fns"
import { fr } from "date-fns/locale"

async function getDashboardData(isFiscal: boolean) {
  const supabase = await createClient()
  const thirtyDaysAgo = subDays(new Date(), 30).toISOString()

  // Prepare queries
  let posQuery = supabase.from("ventes_pos").select("montant_ttc, created_at, mode_paiement, inclure_tva").gte("created_at", thirtyDaysAgo)
  let invQuery = supabase.from("bon_livraisons").select("montant_ttc, created_at, montant_regle, inclure_tva").gte("created_at", thirtyDaysAgo)
  let purQuery = supabase.from("bon_achats").select("montant_ttc, montant_regle, inclure_tva").gte("created_at", thirtyDaysAgo)
  
  // Apply Fiscal Filtering
  if (isFiscal) {
    posQuery = posQuery.eq("inclure_tva", true)
    invQuery = invQuery.eq("inclure_tva", true)
    purQuery = purQuery.eq("inclure_tva", true)
  }

  // Execute Core Queries
  const [clients, articles, salesPos, salesInv, purchases, tresoreries, stockEntries] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }),
    supabase.from("articles").select("id", { count: "exact", head: true }),
    posQuery,
    invQuery,
    purQuery,
    supabase.from("tresoreries").select("solde, solde_fiscale"),
    supabase.from("stock").select("quantite, quantite_fiscale, article:articles(seuil_alerte, famille:familles_articles(libelle))")
  ])

  const posData = (salesPos.data || []) as any[]
  const invData = (salesInv.data || []) as any[]
  const stockData = (stockEntries.data || []) as any[]
  const tresData = (tresoreries.data || []) as any[]

  // 1. Financial Metrics (Facturé vs Global)
  const totalRevenue = posData.reduce((s, v) => s + Number(v.montant_ttc), 0) + 
                       invData.reduce((s, v) => s + Number(v.montant_ttc), 0)
  
  const totalUnpaid = invData.reduce((s, v) => s + (Number(v.montant_ttc) - Number(v.montant_regle || 0)), 0)
  
  // Stock alerts change based on the mode
  const totalStockAlerts = stockData.filter((s: any) => {
    const qty = isFiscal ? Number(s.quantite_fiscale || 0) : Number(s.quantite || 0)
    return qty <= (s.article?.seuil_alerte || 0)
  }).length || 0

  // Treasury balance changes based on the mode
  const cashOnHand = tresData.reduce((s, t) => s + Number(isFiscal ? t.solde_fiscale : t.solde), 0)

  // 2. Daily Stats for Chart (last 14 days)
  const dailyData = Array.from({ length: 14 }).map((_, i) => {
    const d = subDays(new Date(), 13 - i)
    const dStr = format(d, "yyyy-MM-dd")
    const dDisplay = format(d, "dd/MM")
    
    const posOnDay = posData.filter(v => format(new Date(v.created_at), "yyyy-MM-dd") === dStr)
    const invOnDay = invData.filter(v => format(new Date(v.created_at), "yyyy-MM-dd") === dStr)
    
    const rev = posOnDay.reduce((s, v) => s + Number(v.montant_ttc), 0) + 
                invOnDay.reduce((s, v) => s + Number(v.montant_ttc), 0)
    
    return {
      date: dDisplay,
      revenue: rev,
      profit: rev * 0.28 // Simplified margin
    }
  })

  // 3. Payment Modes Distribution
  const modesMap = posData.reduce((acc: any, curr) => {
    acc[curr.mode_paiement] = (acc[curr.mode_paiement] || 0) + Number(curr.montant_ttc)
    return acc
  }, {})

  const paymentModes = Object.entries(modesMap).map(([name, value]) => ({ 
    name: name.charAt(0).toUpperCase() + name.slice(1), 
    value: Number(value) 
  }))

  const categoriesMap = stockData.reduce((acc: any, curr: any) => {
    const cat = curr.article?.famille?.libelle || "Autres"
    acc[cat] = (acc[cat] || 0) + 1
    return acc
  }, {})
  
  const topCategories = Object.entries(categoriesMap)
    .map(([name, value]) => ({ name, value: Number(value) }))
    .sort((a,b) => b.value - a.value)
    .slice(0, 5)

  return {
    kpis: {
      clients: clients.count || 0,
      articles: articles.count || 0,
      revenue: totalRevenue,
      unpaid: totalUnpaid,
      alerts: totalStockAlerts,
      cash: cashOnHand
    },
    dailyData,
    paymentModes: paymentModes.length > 0 ? paymentModes : [{name: "Espèces", value: 0}],
    topCategories: topCategories.length > 0 ? topCategories : [{name: "Divers", value: 0}]
  }
}

async function getRecentActivity(isFiscal: boolean) {
  const supabase = await createClient()
  let query = supabase.from("ventes_pos")
    .select("id, numero, created_at, montant_ttc, mode_paiement, inclure_tva, client:clients(raison_sociale)")
  
  if (isFiscal) query = query.eq("inclure_tva", true)

  const { data } = await query
    .order("created_at", { ascending: false })
    .limit(8)
  
  return (data || []) as any[]
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams
  const isFiscal = params.mode === "fiscal"
  
  const [data, activity] = await Promise.all([
    getDashboardData(isFiscal), 
    getRecentActivity(isFiscal)
  ])

  const kpiCards = [
    { title: `CA (30j) ${isFiscal ? '[F]' : ''}`, value: `${data.kpis.revenue.toFixed(2)} DH`, icon: DollarSign, trend: "+12.5%", color: "text-amber-600 dark:text-amber-500", bg: "bg-amber-500/10" },
    { title: "Créances", value: `${data.kpis.unpaid.toFixed(2)} DH`, icon: AlertTriangle, trend: "Action requise", color: "text-red-600 dark:text-red-500", bg: "bg-red-500/10" },
    { title: isFiscal ? "Solde Fiscal" : "Trésorerie Totale", value: `${data.kpis.cash.toFixed(2)} DH`, icon: Wallet, trend: "Stable", color: "text-emerald-600 dark:text-emerald-500", bg: "bg-emerald-500/10" },
    { title: "Alertes Stock", value: data.kpis.alerts, icon: Package, trend: `${data.kpis.alerts} à réappro.`, color: data.kpis.alerts > 0 ? "text-orange-600 dark:text-orange-500" : "text-muted-foreground", bg: "bg-orange-500/10" },
  ]

  return (
    <div className="space-y-8 pb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
             Dashboard {isFiscal ? "Fiscal" : "Global"}
          </h2>
          <p className="text-muted-foreground mt-1">
            {isFiscal 
              ? "Analyse focalisée sur l'activité facturée avec TVA" 
              : "Analyse globale de votre écosystème commercial"}
          </p>
        </div>
        <div className="flex items-center gap-2 p-1 rounded-lg border border-border bg-card">
          <Badge variant="outline" className={isFiscal ? "border-amber-500 text-amber-500" : "border-muted-foreground/30 text-muted-foreground"}>
            {isFiscal ? <ReceiptText className="h-3 w-3 mr-1" /> : <Globe className="h-3 w-3 mr-1" />}
            {isFiscal ? "Facturé" : "Global"}
          </Badge>
          <span className="text-xs font-medium px-2">{format(new Date(), "PP", { locale: fr })}</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.title} className={`border-border/50 transition-all cursor-default ${isFiscal ? 'bg-amber-500/5 border-amber-500/20' : 'bg-card/50 hover:bg-card'}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
              <div className={`p-2 rounded-md ${kpi.bg}`}>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{kpi.value}</div>
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Activity className="h-3 w-3" /> {kpi.trend}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-6">
        <RevenueChart data={data.dailyData} />
        
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="text-lg">Santé Financière</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Objectif Annuel</span>
                  <span className="font-bold">78%</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 w-[78%]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Articles Actifs</p>
                  <p className="text-xl font-bold">{data.kpis.articles}</p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Base Clients</p>
                  <p className="text-xl font-bold">{data.kpis.clients}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 overflow-hidden relative">
            <CardHeader className="pb-0">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Activity className="h-4 w-4 text-amber-500" /> Flux {isFiscal ? 'Fiscal' : 'Global'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
               <div className="h-24 w-full bg-gradient-to-t from-amber-500/5 to-transparent flex items-end px-4 pb-2">
                  <div className="flex gap-1 items-end w-full h-12">
                     {[4,7,3,9,5,12,8,15,10,18,14].map((h, i) => (
                       <div key={i} className="flex-1 bg-amber-500/20 rounded-t-sm" style={{ height: `${h * 4}px` }} />
                     ))}
                  </div>
               </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <DistributionCharts paymentModes={data.paymentModes} topCategories={data.topCategories} />

      <Card className="border-border/50 bg-card/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Activités {isFiscal ? 'Facturées' : 'Récents'}</CardTitle>
            <CardDescription>
              {isFiscal 
                ? "Dernières transactions en mode fiscal" 
                : "Dernières transactions de l'écosystème global"}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild className="border-border/50 hover:bg-muted font-semibold">
            <Link href="/historique-pos">Voir tout</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left pb-3 font-medium">N° Transaction</th>
                  <th className="text-left pb-3 font-medium">Client</th>
                  <th className="text-left pb-3 font-medium">Date</th>
                  <th className="text-left pb-3 font-medium">Mode</th>
                  <th className="text-right pb-3 font-medium">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {activity.map((v: any) => (
                  <tr key={v.id} className="group hover:bg-muted/30 transition-colors">
                    <td className="py-4 font-mono text-amber-600 dark:text-amber-500/80">{v.numero}</td>
                    <td className="py-4 font-medium">{v.client?.raison_sociale || "Passager"}</td>
                    <td className="py-4 text-muted-foreground">{format(new Date(v.created_at), "HH:mm")} · {format(new Date(v.created_at), "dd MMM")}</td>
                    <td className="py-4 text-xs">
                       <Badge variant="outline" className={v.inclure_tva ? "bg-amber-500/10 border-amber-500/20 text-amber-600" : "bg-muted/50 border-border"}>
                         {v.mode_paiement} {v.inclure_tva && " (F)"}
                       </Badge>
                    </td>
                    <td className="py-4 text-right font-bold">{Number(v.montant_ttc).toFixed(2)} DH</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
