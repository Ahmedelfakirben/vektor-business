"use client"

import { useState, useEffect, useMemo } from "react"
import { useFournisseurs } from "@/hooks/use-fournisseurs"
import { useBonCommandesByFournisseur, useBonCommandeList } from "@/hooks/use-bon-commandes"
import { useBonAchatsByFournisseur, useBonAchatList } from "@/hooks/use-bon-achats"
import { DataTable } from "@/components/data-table/data-table"
import { ColumnDef } from "@tanstack/react-table"
import type { BonCommande, BonAchat } from "@/types/database"
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

export default function EtatFournisseurPage() {
    const { data: fournisseurs, isLoading: loadingFournisseurs } = useFournisseurs()
    const [selectedFournisseurId, setSelectedFournisseurId] = useState<string>("all")
    const [isMounted, setIsMounted] = useState(false)
    const { fiscalMode } = useFiscalMode()

    const [dateDebut, setDateDebut] = useState<string>("")
    const [dateFin, setDateFin] = useState<string>("")

    useEffect(() => {
        setIsMounted(true)
    }, [])

    const { data: clientCommandes, isLoading: loadingClientCommandes } = useBonCommandesByFournisseur(selectedFournisseurId)
    const { data: clientAchats, isLoading: loadingClientAchats } = useBonAchatsByFournisseur(selectedFournisseurId)

    const { data: allCommandes, isLoading: loadingAllCommandes } = useBonCommandeList()
    const { data: allAchats, isLoading: loadingAllAchats } = useBonAchatList()

    // FILTERING (FISCAL + DATE)
    const filteredCommandes = useMemo(() => {
        let raw = selectedFournisseurId !== "all" ? clientCommandes : allCommandes
        if (!raw) return []

        if (fiscalMode) raw = raw.filter(c => c.inclure_tva === true)
        if (dateDebut) raw = raw.filter(c => c.date >= dateDebut)
        if (dateFin) raw = raw.filter(c => c.date <= dateFin)
        
        return raw
    }, [clientCommandes, allCommandes, selectedFournisseurId, fiscalMode, dateDebut, dateFin])

    const filteredAchats = useMemo(() => {
        let raw = selectedFournisseurId !== "all" ? clientAchats : allAchats
        if (!raw) return []

        if (fiscalMode) raw = raw.filter(a => a.inclure_tva === true)
        if (dateDebut) raw = raw.filter(a => a.date >= dateDebut)
        if (dateFin) raw = raw.filter(a => a.date <= dateFin)
            
        return raw
    }, [clientAchats, allAchats, selectedFournisseurId, fiscalMode, dateDebut, dateFin])

    const isLoading = loadingFournisseurs || (selectedFournisseurId !== "all" ? (loadingClientCommandes || loadingClientAchats) : (loadingAllCommandes || loadingAllAchats))

    const commandesColumns: ColumnDef<BonCommande>[] = [
        { accessorKey: "date", header: "Date", cell: ({ row }) => new Date(row.original.date).toLocaleDateString("fr-FR") },
        { 
            accessorKey: "numero", 
            header: "N° BC",
            cell: ({ row }) => (
                <Link href={`/bon-commandes/${row.original.id}`} className="font-mono text-xs font-bold text-orange-600 hover:underline">
                    {row.original.numero}
                </Link>
            )
        },
        { 
            accessorKey: "fournisseur.raison_sociale", 
            header: "Fournisseur", 
            cell: ({ row }) => row.original.fournisseur?.raison_sociale || "N/A" 
        },
        { accessorKey: "montant_ttc", header: "Total TTC", cell: ({ row }) => <span className="font-medium">{Number(row.original.montant_ttc).toFixed(2)}</span> },
        { accessorKey: "statut", header: "Statut", cell: ({ row }) => <Badge variant={statusColors[row.original.statut] || "outline"}>{row.original.statut}</Badge> },
        {
            id: "actions",
            enableSorting: false,
            cell: ({ row }) => (
                <div onClick={(e) => e.stopPropagation()}>
                    <Button asChild variant="ghost" size="sm">
                        <Link href={`/bon-commandes/${row.original.id}`}><Eye className="h-4 w-4 mr-2" />Voir</Link>
                    </Button>
                </div>
            ),
        },
    ]

    const achatsColumns: ColumnDef<BonAchat>[] = [
        { accessorKey: "date", header: "Date", cell: ({ row }) => new Date(row.original.date).toLocaleDateString("fr-FR") },
        { 
            accessorKey: "numero", 
            header: "N° BA / Facture",
            cell: ({ row }) => (
                <Link href={`/bon-achats/${row.original.id}`} className="font-mono text-xs font-bold text-orange-600 hover:underline">
                    {row.original.numero}
                </Link>
            )
        },
        { 
            accessorKey: "fournisseur.raison_sociale", 
            header: "Fournisseur", 
            cell: ({ row }) => row.original.fournisseur?.raison_sociale || "N/A" 
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
                        <Link href={`/bon-achats/${row.original.id}`}><Eye className="h-4 w-4" /></Link>
                    </Button>
                </div>
            ),
        },
    ]

    if (isLoading) return <LoadingScreen />

    const achatsPayes = filteredAchats?.filter(a => a.statut_paiement === "paye" || a.statut_paiement === "partiel" && Number(a.montant_regle) > 0) || []
    const impayes = filteredAchats?.filter(a => !a.statut_paiement || a.statut_paiement === "impaye" || (a.statut_paiement === "partiel" && Number(a.montant_ttc) > Number(a.montant_regle || 0))) || []

    const historiqueGlobal = [
        ...(filteredCommandes || []).map(c => ({ ...c, doc_type: "Commande", num: c.numero, montant: c.montant_ttc, date_val: new Date(c.date) })),
        ...(filteredAchats || []).map(a => ({ ...a, doc_type: "Achat/Facture", num: a.numero, montant: a.montant_ttc, date_val: new Date(a.date) }))
    ].sort((a, b) => b.date_val.getTime() - a.date_val.getTime())

    const totalImpaye = impayes.reduce((acc, curr) => acc + (Number(curr.montant_ttc) - Number(curr.montant_regle || 0)), 0)
    const fournisseurActuel = fournisseurs?.find(f => f.id === selectedFournisseurId)

    const handlePrintStatement = () => {
        if (!fournisseurActuel) return
        generateEtatTiersPDF(
            "Relevé de Compte Fournisseur",
            fournisseurActuel,
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
                            {fiscalMode ? "Dettes Facturées" : "Comptes Fournisseurs"}
                        </h2>
                        <p className="text-muted-foreground">
                            {selectedFournisseurId !== "all" 
                                ? `Dossier ${fiscalMode ? 'fiscal' : 'complet'} de ${fournisseurActuel?.raison_sociale}` 
                                : `Aperçu ${fiscalMode ? 'des dettes facturées' : 'global des dettes fournisseurs'}`
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
                        <Select value={selectedFournisseurId} onValueChange={setSelectedFournisseurId}>
                            <SelectTrigger className={fiscalMode ? "border-amber-500/50 h-9" : "h-9"}>
                                <SelectValue placeholder="Tous los proveedores" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tous les fournisseurs</SelectItem>
                                {fournisseurs?.map(f => (
                                    <SelectItem key={f.id} value={f.id}>{f.code} - {f.raison_sociale}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {selectedFournisseurId !== "all" && (
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
                            {selectedFournisseurId !== "all" ? fournisseurActuel?.raison_sociale : "État Global"}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {selectedFournisseurId !== "all" ? `Code: ${fournisseurActuel?.code}` : `${fournisseurs?.length || 0} fournisseurs actifs`}
                        </p>
                    </CardContent>
                </Card>
                <Card className={fiscalMode ? "border-amber-500/20 bg-amber-500/5" : ""}>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Volume d'Achats {fiscalMode ? '[F]' : ''}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {(filteredAchats?.reduce((acc, a) => acc + Number(a.montant_ttc), 0) || 0).toFixed(2)} DH
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 text-amber-600 font-medium">Total {fiscalMode ? 'facturé' : 'global'}</p>
                    </CardContent>
                </Card>
                <Card className={`border-destructive ${fiscalMode ? "bg-red-500/5" : ""}`}>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-destructive">Dettes (Restant dû)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-destructive">{totalImpaye.toFixed(2)} DH</div>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">Total dû {fiscalMode ? 'facturé' : 'global'}</p>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="impayes" className="w-full">
                <TabsList className={`grid w-full grid-cols-4 p-1 ${fiscalMode ? 'bg-amber-500/10' : ''}`}>
                    <TabsTrigger value="impayes" className={fiscalMode ? "data-[state=active]:bg-amber-500 data-[state=active]:text-white" : ""}>Dettes</TabsTrigger>
                    <TabsTrigger value="achats" className={fiscalMode ? "data-[state=active]:bg-amber-500 data-[state=active]:text-white" : ""}>Achats Payés</TabsTrigger>
                    <TabsTrigger value="commandes" className={fiscalMode ? "data-[state=active]:bg-amber-500 data-[state=active]:text-white" : ""}>Commandes</TabsTrigger>
                    <TabsTrigger value="historique" className={fiscalMode ? "data-[state=active]:bg-amber-500 data-[state=active]:text-white" : ""}>Historique</TabsTrigger>
                </TabsList>
                
                <TabsContent value="impayes" className="mt-6">
                    <Card className={fiscalMode ? "border-amber-500/20" : ""}>
                        <CardHeader><CardTitle>Achats Impayés {fiscalMode ? 'Facturés' : ''}</CardTitle></CardHeader>
                        <CardContent>
                            <DataTable 
                                columns={achatsColumns} 
                                data={impayes} 
                                searchPlaceholder="Chercher..." 
                                getRowHref={(row) => `/bon-achats/${row.id}`}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="achats" className="mt-6">
                    <Card className={fiscalMode ? "border-amber-500/20" : ""}>
                        <CardHeader><CardTitle>Factures / B.A. Payés {fiscalMode ? 'Facturés' : ''}</CardTitle></CardHeader>
                        <CardContent>
                            <DataTable 
                                columns={achatsColumns} 
                                data={achatsPayes} 
                                searchPlaceholder="Chercher..." 
                                getRowHref={(row) => `/bon-achats/${row.id}`}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="commandes" className="mt-6">
                    <Card className={fiscalMode ? "border-amber-500/20" : ""}>
                        <CardHeader><CardTitle>Liste des Commandes {fiscalMode ? 'Facturées' : ''}</CardTitle></CardHeader>
                        <CardContent>
                            <DataTable 
                                columns={commandesColumns} 
                                data={filteredCommandes || []} 
                                searchPlaceholder="Chercher..." 
                                getRowHref={(row) => `/bon-commandes/${row.id}`}
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
                                                    <p className="font-semibold text-sm">{doc.fournisseur?.raison_sociale}</p>
                                                </div>
                                                <p className="font-medium">{doc.num}</p>
                                                <p className="text-xs text-muted-foreground">{doc.date_val.toLocaleDateString("fr-FR")}</p>
                                            </div>
                                            <div className="flex flex-col items-end mt-2 sm:mt-0">
                                                <span className={`font-bold ${fiscalMode ? "text-amber-600" : "text-orange-600 dark:text-orange-400"}`}>{Number(doc.montant).toFixed(2)} DH</span>
                                                <Button variant="link" size="sm" asChild className="p-0 h-auto text-xs">
                                                    <Link href={doc.doc_type === "Commande" ? `/bon-commandes/${doc.id}` : `/bon-achats/${doc.id}`}>Voir détails</Link>
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
