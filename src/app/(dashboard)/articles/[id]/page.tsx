"use client"

import { useParams } from "next/navigation"
import { useArticle, useArticlePurchaseHistory } from "@/hooks/use-articles"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Pencil, History, ShoppingCart, Package } from "lucide-react"
import Link from "next/link"
import { useHistoriqueArticle } from "@/hooks/use-mouvements-stock"
import { DataTable } from "@/components/data-table/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function ArticleDetailPage() {
    const params = useParams()
    const id = params.id as string
    const { data: article, isLoading } = useArticle(id)
    const { data: historique, isLoading: isHistoryLoading } = useHistoriqueArticle(id)
    const { data: purchaseHistory, isLoading: isPurchaseHistoryLoading } = useArticlePurchaseHistory(id)

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-64 w-full" />
            </div>
        )
    }

    if (!article) return <p>Article introuvable</p>

    const getSourceLink = (type: string, id: string) => {
        switch (type) {
            case "bon_livraison": return `/bon-livraisons/${id}`
            case "bon_achat": return `/bon-achats/${id}`
            case "bon_retour": return `/bon-retours/${id}`
            case "bon_retour_achat": return `/bon-retour-achats/${id}`
            case "vente_pos": return `/historique-pos/${id}`
            case "devis": return `/devis/${id}`
            default: return null
        }
    }

    const historyColumns: ColumnDef<any>[] = [
        {
            accessorKey: "created_at",
            header: "Date",
            cell: ({ row }) => new Date(row.original.created_at).toLocaleString("fr-FR"),
        },
        {
            accessorKey: "reference_type",
            header: "Source",
            cell: ({ row }) => {
                const link = getSourceLink(row.original.reference_type, row.original.reference_id)
                const docNumero = row.original.document_numero || row.original.reference_type.replace(/_/g, " ")
                if (link) {
                    return (
                        <Link href={link} className="text-orange-600 hover:underline font-bold uppercase text-[11px]">
                            {docNumero}
                        </Link>
                    )
                }
                return <span className="uppercase font-bold text-[11px]">{docNumero}</span>
            },
        },
        {
            accessorKey: "document_tiers",
            header: "Tiers (Client / Fournisseur)",
            cell: ({ row }) => <span className="font-medium text-xs">{row.original.document_tiers || "—"}</span>,
        },
        {
            accessorKey: "type",
            header: "Type",
            cell: ({ row }) => (
                <span className={row.original.type === "entree" ? "text-[10px] uppercase font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full" : "text-[10px] uppercase font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full"}>
                    {row.original.type === "entree" ? "Entrée" : "Sortie"}
                </span>
            ),
        },
        {
            accessorKey: "quantite",
            header: "Quantité",
            cell: ({ row }) => (
                <span className={`font-black ${row.original.type === "entree" ? 'text-green-600' : 'text-red-600'}`}>
                    {row.original.type === "entree" ? '+' : '-'}{row.original.quantite} {article.unite}
                </span>
            ),
        },
        {
            accessorKey: "document_statut",
            header: "Statut Pay.",
            cell: ({ row }) => {
                const st = (row.original.document_statut as string) || "—";
                if (st === "—") return <span className="text-muted-foreground">-</span>
                return (
                    <span className={
                        st === "paye" ? "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-green-100 text-green-700" :
                        st === "partiel" ? "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-yellow-100 text-yellow-700" :
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-700"
                    }>
                        {st}
                    </span>
                )
            }
        },
        {
            accessorKey: "depot.libelle",
            header: "Dépôt",
            cell: ({ row }) => (row.original.depot as any)?.libelle || "—",
        },
    ]

    const purchaseHistoryColumns: ColumnDef<any>[] = [
        {
            accessorKey: "fecha",
            header: "Fecha",
            cell: ({ row }) => new Date(row.original.fecha).toLocaleDateString("fr-FR"),
        },
        {
            accessorKey: "proveedor",
            header: "Fournisseur",
            cell: ({ row }) => <span className="font-semibold">{row.original.proveedor}</span>,
        },
        {
            accessorKey: "documento",
            header: "Document",
            cell: ({ row }) => (
                <Link href={`/bon-achats/${row.original.documento}`} className="text-orange-600 hover:underline font-bold text-[11px]">
                    {row.original.documento}
                </Link>
            ),
        },
        {
            accessorKey: "precio_compra",
            header: "Prix d'achat",
            cell: ({ row }) => (
                <span className="font-bold text-lg text-primary">
                    {Number(row.original.precio_compra).toFixed(2)} DH
                    {row.original.inclure_tva && <span className="ml-1 text-[10px] font-normal text-muted-foreground">TTC</span>}
                </span>
            ),
        },
        {
            accessorKey: "quantite",
            header: "Qté achetée",
            cell: ({ row }) => <span>{row.original.quantite} {article.unite}</span>,
        },
    ]

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    {article.image_url ? (
                        <img
                            src={article.image_url}
                            alt={article.designation}
                            className="h-16 w-16 rounded-xl object-cover border shadow-sm bg-muted/40"
                        />
                    ) : (
                        <div className="h-16 w-16 rounded-xl border bg-muted/40 flex items-center justify-center">
                            <Package className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                    )}
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">{article.designation}</h2>
                        <p className="text-muted-foreground">Code : {article.code} {article.reference && `| Réf : ${article.reference}`}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant={article.actif ? "default" : "secondary"}>
                        {article.actif ? "Actif" : "Inactif"}
                    </Badge>
                    <Button asChild>
                        <Link href={`/articles/${article.id}/modifier`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Modifier
                        </Link>
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle>Informations générales</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div>
                            <span className="text-sm text-muted-foreground">Famille</span>
                            <p>{article.famille?.libelle || "—"}</p>
                        </div>
                        <div>
                            <span className="text-sm text-muted-foreground">Code Barre</span>
                            <p>{article.code_barre || "—"}</p>
                        </div>
                        <div>
                            <span className="text-sm text-muted-foreground">Unité</span>
                            <p>{article.unite}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-primary/50 bg-primary/5">
                    <CardHeader>
                        <CardTitle>Tarification Actuelle</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div>
                            <span className="text-sm text-muted-foreground">Dernier prix d&apos;achat</span>
                            <p className="text-2xl font-black text-primary">{Number(article.prix_achat).toFixed(2)} DH</p>
                        </div>
                        <div>
                            <span className="text-sm text-muted-foreground">Prix de vente</span>
                            <p className="text-lg font-semibold">{Number(article.prix_vente).toFixed(2)} DH</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Configuration</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div>
                            <span className="text-sm text-muted-foreground">Seuil d&apos;alerte (Stock)</span>
                            <p>{article.seuil_alerte}</p>
                        </div>
                        <div>
                            <span className="text-sm text-muted-foreground">Date de création</span>
                            <p>{new Date(article.created_at).toLocaleDateString("fr-FR")}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="mt-8">
                <Tabs defaultValue="stock" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="stock" className="flex items-center gap-2">
                            <History className="h-4 w-4" />
                            Historique des Mouvements
                        </TabsTrigger>
                        <TabsTrigger value="purchases" className="flex items-center gap-2">
                            <ShoppingCart className="h-4 w-4" />
                            Historial de Compras
                        </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="stock">
                        <Card>
                            <CardContent className="p-0">
                                {isHistoryLoading ? (
                                    <div className="p-4"><Skeleton className="h-32 w-full" /></div>
                                ) : (
                                    <DataTable 
                                        columns={historyColumns} 
                                        data={historique || []} 
                                        searchPlaceholder="Filtrer l'historique..."
                                    />
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                    
                    <TabsContent value="purchases">
                        <Card>
                            <CardContent className="p-0">
                                {isPurchaseHistoryLoading ? (
                                    <div className="p-4"><Skeleton className="h-32 w-full" /></div>
                                ) : (
                                    <DataTable 
                                        columns={purchaseHistoryColumns} 
                                        data={purchaseHistory || []} 
                                        searchPlaceholder="Filtrer par fournisseur..."
                                    />
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
}
