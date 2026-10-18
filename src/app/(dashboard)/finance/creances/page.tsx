"use client"

import { useState, useEffect, useMemo } from "react"
import { useClients } from "@/hooks/use-clients"
import { useDevisByClient, useDevisList } from "@/hooks/use-devis"
import { useBonLivraisonsByClient, useBonLivraisonList } from "@/hooks/use-bon-livraisons"
import { DataTable } from "@/components/data-table/data-table"
import { ColumnDef } from "@tanstack/react-table"
import type { Devis, BonLivraison } from "@/types/database"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Eye, ReceiptText, Globe, Download } from "lucide-react"
import Link from "next/link"
import { LoadingScreen } from "@/components/ui/loading-screen"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useFiscalMode } from "@/providers/fiscal-mode-context"
import { generateEtatTiersPDF } from "@/lib/pdf-etat-generator"
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns"

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    paye: "default",
    partiel: "secondary",
    impaye: "destructive",
    brouillon: "secondary",
    valide: "default"
}

export default function EtatClientPage() {
    const { data: clients, isLoading: loadingClients } = useClients()
    const [selectedClientId, setSelectedClientId] = useState<string>("all")
    const [isMounted, setIsMounted] = useState(false)
    const { fiscalMode } = useFiscalMode()

    useEffect(() => {
        setIsMounted(true)
    }, [])

    const [dateDebut, setDateDebut] = useState<string>("")
    const [dateFin, setDateFin] = useState<string>("")

    const { data: clientDevis, isLoading: loadingClientDevis } = useDevisByClient(selectedClientId)
    const { data: clientFactures, isLoading: loadingClientFactures } = useBonLivraisonsByClient(selectedClientId)
    
    const { data: allDevis, isLoading: loadingAllDevis } = useDevisList()
    const { data: allFactures, isLoading: loadingAllFactures } = useBonLivraisonList()

    // FILTERING (FISCAL + DATE)
    const filteredDevis = useMemo(() => {
        let raw = selectedClientId !== "all" ? clientDevis : allDevis
        if (!raw) return []

        if (fiscalMode) raw = raw.filter(d => d.inclure_tva === true)
        if (dateDebut) raw = raw.filter(d => d.date >= dateDebut)
        if (dateFin) raw = raw.filter(d => d.date <= dateFin)
        
        return raw
    }, [clientDevis, allDevis, selectedClientId, fiscalMode, dateDebut, dateFin])

    const filteredFactures = useMemo(() => {
        let raw = selectedClientId !== "all" ? clientFactures : allFactures
        if (!raw) return []

        if (fiscalMode) raw = raw.filter(f => f.inclure_tva === true)
        if (dateDebut) raw = raw.filter(f => f.date >= dateDebut)
        if (dateFin) raw = raw.filter(f => f.date <= dateFin)
            
        return raw
    }, [clientFactures, allFactures, selectedClientId, fiscalMode, dateDebut, dateFin])

    const isLoading = loadingClients || (selectedClientId !== "all" ? (loadingClientDevis || loadingClientFactures) : (loadingAllDevis || loadingAllFactures))

    const devisColumns: ColumnDef<Devis>[] = [
        { accessorKey: "date", header: "Date", cell: ({ row }) => new Date(row.original.date).toLocaleDateString("fr-FR") },
        { 
            accessorKey: "numero", 
            header: "N° Devis",
            cell: ({ row }) => (
                <Link href={`/devis/${row.original.id}`} className="font-mono text-xs font-bold text-orange-600 hover:underline">
                    {row.original.numero}
                </Link>
            )
        },
        { 
            accessorKey: "client.raison_sociale", 
            header: "Client", 
            cell: ({ row }) => row.original.client?.raison_sociale || "N/A"
        },
        { accessorKey: "montant_ttc", header: "Total TTC", cell: ({ row }) => <span className="font-medium">{Number(row.original.montant_ttc).toFixed(2)}</span> },
        { accessorKey: "statut", header: "Statut", cell: ({ row }) => <Badge variant={statusColors[row.original.statut] || "outline"}>{row.original.statut}</Badge> },
        {
            id: "actions",
            enableSorting: false,
            cell: ({ row }) => (
                <div onClick={(e) => e.stopPropagation()}>
                    <Button asChild variant="ghost" size="sm">
                        <Link href={`/devis/${row.original.id}`}><Eye className="h-4 w-4 mr-2" />Voir</Link>
                    </Button>
                </div>
            ),
        },
    ]

    const facturesColumns: ColumnDef<BonLivraison>[] = [
        { accessorKey: "date", header: "Date", cell: ({ row }) => new Date(row.original.date).toLocaleDateString("fr-FR") },
        { 
            accessorKey: "numero", 
            header: "N° Facture/BL",
            cell: ({ row }) => (
                <Link href={`/bon-livraisons/${row.original.id}`} className="font-mono text-xs font-bold text-orange-600 hover:underline">
                    {row.original.numero}
                </Link>
            )
        },
        { 
            accessorKey: "client.raison_sociale", 
            header: "Client", 
            cell: ({ row }) => row.original.client?.raison_sociale || "N/A" 
        },
        { accessorKey: "montant_ttc", header: "Total TTC", cell: ({ row }) => <span className="font-medium">{Number(row.original.montant_ttc).toFixed(2)}</span> },
        { accessorKey: "montant_regle", header: "Réglé", cell: ({ row }) => <span className="text-muted-foreground">{Number(row.original.montant_regle || 0).toFixed(2)}</span> },
        {
            id: "reste", header: "Reste", cell: ({ row }) => {
                const reste = Number(row.original.montant_ttc) - Number(row.original.montant_regle || 0)
                return <span className={`font-bold ${reste > 0 ? "text-destructive" : ""}`}>{reste.toFixed(2)}</span>
            }
        },
        { accessorKey: "statut_paiement", header: "Statut", cell: ({ row }) => <Badge variant={statusColors[row.original.statut_paiement || "impaye"] || "outline"} className="capitalize">{row.original.statut_paiement || "impaye"}</Badge> },
        {
            id: "actions",
            enableSorting: false,
            cell: ({ row }) => (
                <div onClick={(e) => e.stopPropagation()}>
                    <Button asChild variant="ghost" size="sm">
                        <Link href={`/bon-livraisons/${row.original.id}`}><Eye className="h-4 w-4" /></Link>
                    </Button>
                </div>
            ),
        },
    ]

    if (isLoading) return <LoadingScreen />

    const facturesPayees = filteredFactures?.filter(f => f.statut_paiement === "paye" || f.statut_paiement === "partiel" && Number(f.montant_regle) > 0) || []
    const impayes = filteredFactures?.filter(f => !f.statut_paiement || f.statut_paiement === "impaye" || (f.statut_paiement === "partiel" && Number(f.montant_ttc) > Number(f.montant_regle || 0))) || []

    const historiqueGlobal = [
        ...(filteredDevis || []).map(d => ({ ...d, doc_type: "Devis", num: d.numero, montant: d.montant_ttc, date_val: new Date(d.date) })),
        ...(filteredFactures || []).map(f => ({ ...f, doc_type: "Facture/BL", num: f.numero, montant: f.montant_ttc, date_val: new Date(f.date) }))
    ].sort((a, b) => b.date_val.getTime() - a.date_val.getTime())

    const totalImpaye = impayes.reduce((acc, curr) => acc + (Number(curr.montant_ttc) - Number(curr.montant_regle || 0)), 0)
    const clientActuel = clients?.find(c => c.id === selectedClientId)

    const handlePrintStatement = () => {
        if (!clientActuel) return
        generateEtatTiersPDF(
            "Relevé de Compte Client",
            clientActuel,
            historiqueGlobal, // The already filtered history (fiscal + date)
            { start: dateDebut, end: dateFin }
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl border ${fiscalMode ? "bg-amber-500/10 border-amber-500/20" : "bg-muted border-border"}`}>
                        {fiscalMode ? <ReceiptText className="h-6 w-6 text-amber-500" /> : <Globe className="h-6 w-6 text-muted-foreground" />}
                    </div>
                    <div>
                        <h2 className={`text-3xl font-bold tracking-tight ${fiscalMode ? "text-amber-500" : ""}`}>
                            {fiscalMode ? "Comptes Facturés" : "Gestion des Comptes"}
                        </h2>
                        <p className="text-muted-foreground">
                            {selectedClientId !== "all" 
                                ? `Dossier ${fiscalMode ? 'fiscal' : 'complet'} de ${clientActuel?.raison_sociale}` 
                                : `Aperçu ${fiscalMode ? 'des créances facturées' : 'global des créances clients'}`
                            }
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Select onValueChange={(val) => {
                        const now = new Date()
                        if (val === "today") {
                            const d = format(now, "yyyy-MM-dd")
                            setDateDebut(d); setDateFin(d)
                        } else if (val === "week") {
                            setDateDebut(format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"))
                            setDateFin(format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"))
                        } else if (val === "month") {
                            setDateDebut(format(startOfMonth(now), "yyyy-MM-dd"))
                            setDateFin(format(endOfMonth(now), "yyyy-MM-dd"))
                        } else if (val === "year") {
                            setDateDebut(format(new Date(now.getFullYear(), 0, 1), "yyyy-MM-dd"))
                            setDateFin(format(new Date(now.getFullYear(), 11, 31), "yyyy-MM-dd"))
                        }
                    }}>
                        <SelectTrigger className="w-[120px] h-9 text-xs">
                            <SelectValue placeholder="Période" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="today">Aujourd'hui</SelectItem>
                            <SelectItem value="week">Cette Semaine</SelectItem>
                            <SelectItem value="month">Ce Mois</SelectItem>
                            <SelectItem value="year">Cette Année</SelectItem>
                        </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2 mr-2">
                        <Input 
                            type="date" 
                            value={dateDebut} 
                            onChange={(e) => setDateDebut(e.target.value)} 
                            className="w-[140px] text-xs h-9"
                        />
                        <span className="text-muted-foreground text-xs">à</span>
                        <Input 
                            type="date" 
                            value={dateFin} 
                            onChange={(e) => setDateFin(e.target.value)} 
                            className="w-[140px] text-xs h-9"
                        />
                    </div>
                    <div className="w-full md:w-[250px] flex items-center gap-2">
                        <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                            <SelectTrigger className={fiscalMode ? "border-amber-500/50 h-9" : "h-9"}>
                                <SelectValue placeholder="Tous les clients" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tous les clients</SelectItem>
                                {clients?.map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.code} - {c.raison_sociale}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {selectedClientId !== "all" && (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-9 w-9 p-0"
                                title="Imprimer Relevé"
                                onClick={handlePrintStatement}
                            >
                                <Download className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3 mb-6">
                <Card className={fiscalMode ? "border-amber-500/20 bg-amber-500/5" : ""}>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Informations</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {selectedClientId !== "all" ? clientActuel?.raison_sociale : "État Global"}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {selectedClientId !== "all" ? `Code: ${clientActuel?.code}` : `${clients?.length || 0} clients actifs`}
                        </p>
                    </CardContent>
                </Card>
                <Card className={fiscalMode ? "border-amber-500/20 bg-amber-500/5" : ""}>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Volume d'Affaires {fiscalMode ? '[F]' : ''}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {(filteredFactures?.reduce((acc, f) => acc + Number(f.montant_ttc), 0) || 0).toFixed(2)} DH
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 text-amber-600 font-medium">Total {fiscalMode ? 'facturé' : 'global'}</p>
                    </CardContent>
                </Card>
                <Card className={`border-destructive ${fiscalMode ? "bg-red-500/5" : ""}`}>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-destructive">Créances (Impayés)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-destructive">{totalImpaye.toFixed(2)} DH</div>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">Total restant dû {fiscalMode ? 'facturé' : ''}</p>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="impayes" className="w-full">
                <TabsList className={`grid w-full grid-cols-4 p-1 ${fiscalMode ? 'bg-amber-500/10' : ''}`}>
                    <TabsTrigger value="impayes" className={fiscalMode ? "data-[state=active]:bg-amber-500 data-[state=active]:text-white" : ""}>Impayés</TabsTrigger>
                    <TabsTrigger value="factures" className={fiscalMode ? "data-[state=active]:bg-amber-500 data-[state=active]:text-white" : ""}>Factures</TabsTrigger>
                    <TabsTrigger value="devis" className={fiscalMode ? "data-[state=active]:bg-amber-500 data-[state=active]:text-white" : ""}>Devis</TabsTrigger>
                    <TabsTrigger value="historique" className={fiscalMode ? "data-[state=active]:bg-amber-500 data-[state=active]:text-white" : ""}>Historique</TabsTrigger>
                </TabsList>
                
                <TabsContent value="impayes" className="mt-6">
                    <Card className={fiscalMode ? "border-amber-500/20" : ""}>
                        <CardHeader><CardTitle>Factures Impayées {fiscalMode ? 'Facturées' : ''}</CardTitle></CardHeader>
                        <CardContent>
                            <DataTable 
                                columns={facturesColumns} 
                                data={impayes} 
                                searchPlaceholder="Chercher..." 
                                getRowHref={(row) => `/bon-livraisons/${row.id}`}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="factures" className="mt-6">
                    <Card className={fiscalMode ? "border-amber-500/20" : ""}>
                        <CardHeader><CardTitle>Factures / B.L. Payés {fiscalMode ? 'Facturés' : ''}</CardTitle></CardHeader>
                        <CardContent>
                            <DataTable 
                                columns={facturesColumns} 
                                data={facturesPayees} 
                                searchPlaceholder="Chercher..." 
                                getRowHref={(row) => `/bon-livraisons/${row.id}`}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="devis" className="mt-6">
                    <Card className={fiscalMode ? "border-amber-500/20" : ""}>
                        <CardHeader><CardTitle>Liste des Devis {fiscalMode ? 'Facturés' : ''}</CardTitle></CardHeader>
                        <CardContent>
                            <DataTable 
                                columns={devisColumns} 
                                data={filteredDevis || []} 
                                searchPlaceholder="Chercher..." 
                                getRowHref={(row) => `/devis/${row.id}`}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="historique" className="mt-6">
                    <Card className={fiscalMode ? "border-amber-500/20" : ""}>
                        <CardHeader>
                            <CardTitle>Historique {fiscalMode ? 'Focalisé' : 'Récent'}</CardTitle>
                            <CardDescription>Tous les documents {fiscalMode ? 'facturés' : 'générés'}.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {!isMounted ? <div className="h-32 flex items-center justify-center text-muted-foreground">Chargement...</div> : (
                                <>
                                    {historiqueGlobal.map((doc, idx) => (
                                        <div key={idx} className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border rounded-lg hover:border-amber-500/50 transition-colors ${fiscalMode ? 'bg-amber-500/5 border-amber-500/10' : ''}`}>
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant={fiscalMode ? "default" : "outline"} className={fiscalMode ? "bg-amber-500 hover:bg-amber-600" : ""}>{doc.doc_type}</Badge>
                                                    <p className="font-semibold text-sm">{doc.client?.raison_sociale}</p>
                                                </div>
                                                <p className="font-medium">{doc.num}</p>
                                                <p className="text-xs text-muted-foreground">{doc.date_val.toLocaleDateString("fr-FR")}</p>
                                            </div>
                                            <div className="flex flex-col items-end mt-2 sm:mt-0">
                                                <span className={`font-bold ${fiscalMode ? "text-amber-600" : "text-orange-600 dark:text-orange-400"}`}>{Number(doc.montant).toFixed(2)} DH</span>
                                                <Button variant="link" size="sm" asChild className="p-0 h-auto text-xs">
                                                    <Link href={doc.doc_type === "Devis" ? `/devis/${doc.id}` : `/bon-livraisons/${doc.id}`}>Voir détails</Link>
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                    {historiqueGlobal.length === 0 && <p className="text-center text-muted-foreground py-10">Aucun document facturé trouvé pour ce critère.</p>}
                                </>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
