"use client"

import { useParams } from "next/navigation"
import { useDepot } from "@/hooks/use-depots"
import { useStockByDepot } from "@/hooks/use-stock"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Pencil, Warehouse, ReceiptText } from "lucide-react"
import Link from "next/link"
import { DataTable } from "@/components/data-table/data-table"
import { ColumnDef } from "@tanstack/react-table"
import type { Stock } from "@/types/database"
import { Badge } from "@/components/ui/badge"
import { useFiscalMode } from "@/providers/fiscal-mode-context"

export default function DepotDetailPage() {
    const params = useParams()
    const id = params.id as string
    const { data: depot, isLoading } = useDepot(id)
    const { data: stocks, isLoading: isLoadingStock } = useStockByDepot(id)
    const { fiscalMode } = useFiscalMode()

    if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>
    if (!depot) return <p>Dépôt introuvable</p>

    const responsable = (depot as any).responsable

    const columns: ColumnDef<Stock>[] = [
        {
            accessorKey: "article.code",
            header: "Code",
            cell: ({ row }) => row.original.article?.code || "—"
        },
        {
            accessorKey: "article.designation",
            header: "Désignation",
            cell: ({ row }) => row.original.article?.designation || "—"
        },
        {
            accessorKey: "article.famille",
            header: "Famille",
            cell: ({ row }) => (row.original.article as any)?.famille?.libelle || "—"
        },
        {
            accessorKey: "quantite",
            header: fiscalMode ? "Qté [F]" : "Quantité",
            cell: ({ row }) => {
                const qte = fiscalMode ? Number(row.original.quantite_fiscale || 0) : Number(row.original.quantite)
                const seuil = (row.original.article as any)?.seuil_alerte || 0
                return (
                    <div className={`font-bold flex items-center gap-1.5 ${qte <= 0 ? "text-destructive" : qte <= seuil ? "text-orange-500" : ""}`}>
                        {fiscalMode && <Badge variant="outline" className="text-[9px] h-3.5 px-1 border-amber-500/50 text-amber-600 bg-amber-500/5 uppercase font-bold">F</Badge>}
                        {qte}
                    </div>
                )
            }
        },
        {
            accessorKey: "article.prix_vente",
            header: "Prix Vente",
            cell: ({ row }) => `${Number(row.original.article?.prix_vente || 0).toFixed(2)} DH`
        }
    ]

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className={`p-3 rounded-xl border ${fiscalMode ? "bg-amber-500/10 border-amber-500/20" : "bg-muted border-border"}`}>
                       {fiscalMode ? <ReceiptText className="h-6 w-6 text-amber-500" /> : <Warehouse className="h-6 w-6 text-muted-foreground" />}
                    </div>
                    <div>
                        <h2 className={`text-3xl font-bold tracking-tight ${fiscalMode ? "text-amber-500" : ""}`}>
                           {depot.libelle} {fiscalMode && "[Facturé]"}
                        </h2>
                        <p className="text-muted-foreground">Code : {depot.code}</p>
                    </div>
                </div>
                <Button asChild><Link href={`/depots/${depot.id}/modifier`}><Pencil className="mr-2 h-4 w-4" />Modifier</Link></Button>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2">
                <Card className={fiscalMode ? "border-amber-500/20 bg-amber-500/5" : ""}>
                    <CardHeader><CardTitle className="text-lg">Détails Dépôt</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                        <div><span className="text-sm text-muted-foreground">Adresse</span><p className="font-medium">{depot.adresse || "—"}</p></div>
                        <div><span className="text-sm text-muted-foreground">Responsable</span><p className="font-medium">{responsable ? `${responsable.prenom} ${responsable.nom}` : "—"}</p></div>
                    </CardContent>
                </Card>
            </div>

            <div className="mt-8">
                <div className="mb-4">
                    <h3 className={`text-xl font-semibold tracking-tight ${fiscalMode ? "text-amber-600" : ""}`}>
                       Stock {fiscalMode ? 'Facturé' : 'du dépôt'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                       {fiscalMode 
                         ? "Affichage des quantités basées uniquement sur les entrées/sorties facturées" 
                         : "Liste des articles disponibles dans ce dépôt (Global)"}
                    </p>
                </div>
                {isLoadingStock ? <Skeleton className="h-48 w-full" /> : (
                    <DataTable
                        columns={columns}
                        data={stocks || []}
                        searchPlaceholder="Rechercher un article..."
                    />
                )}
            </div>
        </div>
    )
}
