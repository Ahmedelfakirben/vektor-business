"use client"

import { useParams } from "next/navigation"
import { useFournisseur } from "@/hooks/use-fournisseurs"
import { useBonCommandesByFournisseur } from "@/hooks/use-bon-commandes"
import { useBonAchatsByFournisseur } from "@/hooks/use-bon-achats"
import { useBonRetourAchatsByFournisseur } from "@/hooks/use-bon-retour-achats"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { LoadingScreen } from "@/components/ui/loading-screen"
import { Pencil, Eye } from "lucide-react"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataTable } from "@/components/data-table/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import type { BonCommande, BonAchat, BonRetourAchat } from "@/types/database"

export default function FournisseurDetailPage() {
    const params = useParams()
    const id = params.id as string
    const { data: fournisseur, isLoading } = useFournisseur(id)

    const { data: bcList, isLoading: isLoadingBC } = useBonCommandesByFournisseur(id)
    const { data: baList, isLoading: isLoadingBA } = useBonAchatsByFournisseur(id)
    const { data: braList, isLoading: isLoadingBRA } = useBonRetourAchatsByFournisseur(id)

    if (isLoading) return <LoadingScreen />

    if (!fournisseur) return <p>Fournisseur introuvable</p>

    // --- BC Columns ---
    const bcCols: ColumnDef<BonCommande>[] = [
        { accessorKey: "numero", header: "N° BC" },
        { accessorKey: "date", header: "Date", cell: ({ row }) => new Date(row.original.date).toLocaleDateString("fr-FR") },
        { accessorKey: "montant_ttc", header: "Montant TTC", cell: ({ row }) => `${Number(row.original.montant_ttc).toFixed(2)} MAD` },
        {
            accessorKey: "statut", header: "Statut",
            cell: ({ row }) => {
                const colors: any = { brouillon: "secondary", envoye: "outline", recu: "default", annule: "destructive" }
                const labels: any = { brouillon: "Brouillon", envoye: "Envoyé", recu: "Reçu", annule: "Annulé" }
                return <Badge variant={colors[row.original.statut] || "secondary"}>{labels[row.original.statut] || row.original.statut}</Badge>
            }
        },
        {
            id: "actions",
            enableSorting: false,
            cell: ({ row }) => (
                <Button asChild variant="ghost" size="sm"><Link href={`/bon-commandes/${row.original.id}`}><Eye className="h-4 w-4 mr-2" />Voir</Link></Button>
            )
        }
    ]

    // --- BA Columns ---
    const baCols: ColumnDef<BonAchat>[] = [
        { accessorKey: "numero", header: "N° BA" },
        { accessorKey: "date", header: "Date", cell: ({ row }) => new Date(row.original.date).toLocaleDateString("fr-FR") },
        { accessorKey: "montant_ttc", header: "Montant TTC", cell: ({ row }) => `${Number(row.original.montant_ttc).toFixed(2)} MAD` },
        {
            accessorKey: "statut", header: "Statut",
            cell: ({ row }) => {
                const colors: any = { brouillon: "secondary", valide: "default", paye: "default", annule: "destructive" }
                const labels: any = { brouillon: "Brouillon", valide: "Validé", paye: "Payé", annule: "Annulé" }
                return <Badge variant={colors[row.original.statut] || "secondary"}>{labels[row.original.statut] || row.original.statut}</Badge>
            }
        },
        {
            id: "actions",
            enableSorting: false,
            cell: ({ row }) => (
                <Button asChild variant="ghost" size="sm"><Link href={`/bon-achats/${row.original.id}`}><Eye className="h-4 w-4 mr-2" />Voir</Link></Button>
            )
        }
    ]

    // --- BRA Columns ---
    const braCols: ColumnDef<BonRetourAchat>[] = [
        { accessorKey: "numero", header: "N° BRA" },
        { accessorKey: "date", header: "Date", cell: ({ row }) => new Date(row.original.date).toLocaleDateString("fr-FR") },
        { accessorKey: "montant_ttc", header: "Montant TTC", cell: ({ row }) => `${Number(row.original.montant_ttc).toFixed(2)} MAD` },
        {
            accessorKey: "statut", header: "Statut",
            cell: ({ row }) => {
                const colors: any = { brouillon: "secondary", valide: "default", annule: "destructive" }
                const labels: any = { brouillon: "Brouillon", valide: "Validé", annule: "Annulé" }
                return <Badge variant={colors[row.original.statut] || "secondary"}>{labels[row.original.statut] || row.original.statut}</Badge>
            }
        },
        {
            id: "actions",
            enableSorting: false,
            cell: ({ row }) => (
                <Button asChild variant="ghost" size="sm"><Link href={`/bon-retour-achats/${row.original.id}`}><Eye className="h-4 w-4 mr-2" />Voir</Link></Button>
            )
        }
    ]

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">{fournisseur.raison_sociale}</h2>
                    <p className="text-muted-foreground">Code : {fournisseur.code}</p>
                </div>
                <Button asChild>
                    <Link href={`/fournisseurs/${fournisseur.id}/modifier`}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Modifier
                    </Link>
                </Button>
            </div>

            <Tabs defaultValue="infos" className="w-full">
                <TabsList>
                    <TabsTrigger value="infos">Informations</TabsTrigger>
                    <TabsTrigger value="bc">Bons de Commande ({bcList?.length || 0})</TabsTrigger>
                    <TabsTrigger value="ba">Bons d&apos;Achat ({baList?.length || 0})</TabsTrigger>
                    <TabsTrigger value="bra">Retours ({braList?.length || 0})</TabsTrigger>
                </TabsList>

                <TabsContent value="infos" className="space-y-4 pt-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Coordonnées</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div><span className="text-sm text-muted-foreground">Adresse</span><p>{fournisseur.adresse || "—"}</p></div>
                                <div><span className="text-sm text-muted-foreground">Ville</span><p>{fournisseur.ville || "—"}</p></div>
                                <div><span className="text-sm text-muted-foreground">Téléphone</span><p>{fournisseur.telephone || "—"}</p></div>
                                <div><span className="text-sm text-muted-foreground">E-mail</span><p>{fournisseur.email || "—"}</p></div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Informations légales</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div><span className="text-sm text-muted-foreground">ICE</span><p>{fournisseur.ice || "—"}</p></div>
                                <div><span className="text-sm text-muted-foreground">Date de création</span><p>{new Date(fournisseur.created_at).toLocaleDateString("fr-FR")}</p></div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="bc">
                    <div className="pt-4">
                        {isLoadingBC ? <Skeleton className="h-48 w-full" /> : (
                            <DataTable columns={bcCols} data={bcList || []} searchPlaceholder="Filtrer..." />
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="ba">
                    <div className="pt-4">
                        {isLoadingBA ? <Skeleton className="h-48 w-full" /> : (
                            <DataTable columns={baCols} data={baList || []} searchPlaceholder="Filtrer..." />
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="bra">
                    <div className="pt-4">
                        {isLoadingBRA ? <Skeleton className="h-48 w-full" /> : (
                            <DataTable columns={braCols} data={braList || []} searchPlaceholder="Filtrer..." />
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
