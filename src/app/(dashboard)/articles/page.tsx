"use client"

import { ColumnDef } from "@tanstack/react-table"
import { useArticles, useDeleteArticle } from "@/hooks/use-articles"
import { DataTable } from "@/components/data-table/data-table"
import type { Article } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MoreHorizontal, Pencil, Trash2, Eye, Package } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
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
import Link from "next/link"
import { toast } from "sonner"
import { LoadingScreen } from "@/components/ui/loading-screen"
export default function ArticlesPage() {
    const { data: articles, isLoading } = useArticles()
    const deleteArticle = useDeleteArticle()

    const handleDelete = async (id: string) => {
        try {
            await deleteArticle.mutateAsync(id)
            toast.success("Article supprimé avec succès")
        } catch {
            toast.error("Erreur lors de la suppression de l'article")
        }
    }

    const columns: ColumnDef<Article>[] = [
        {
            accessorKey: "image_url",
            header: "Image",
            enableSorting: false,
            cell: ({ row }) => {
                const img = row.original.image_url
                return (
                    <div className="h-9 w-9 rounded-lg border bg-muted/40 flex items-center justify-center overflow-hidden shrink-0">
                        {img ? (
                            <img src={img} alt={row.original.designation} className="h-full w-full object-cover" />
                        ) : (
                            <Package className="h-4 w-4 text-muted-foreground/60" />
                        )}
                    </div>
                )
            },
        },
        {
            accessorKey: "code",
            header: "Code",
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-bold text-xs text-foreground font-mono">{row.original.code}</span>
                    {row.original.reference && row.original.reference !== row.original.code && (
                        <span className="text-[10px] text-muted-foreground">Réf: {row.original.reference}</span>
                    )}
                </div>
            ),
        },
        {
            accessorKey: "reference",
            header: "Réf.",
            cell: ({ row }) => row.original.reference || "—",
        },
        {
            accessorKey: "designation",
            header: "Désignation",
            cell: ({ row }) => (
                <div className="max-w-[200px] lg:max-w-[280px]" title={row.original.designation}>
                    <p className="font-semibold text-xs text-foreground truncate">{row.original.designation}</p>
                </div>
            ),
        },
        {
            accessorFn: (row) => (row as any).famille?.libelle || "—",
            id: "famille",
            header: "Catégorie",
            cell: ({ row }) => {
                const fam = (row.original as any).famille?.libelle
                const sousFam = (row.original as any).sous_famille?.libelle
                return (
                    <div className="flex flex-col max-w-[140px]">
                        <span className="font-medium text-xs text-foreground truncate">{fam || "—"}</span>
                        {sousFam && (
                            <span className="text-[10px] text-muted-foreground truncate">{sousFam}</span>
                        )}
                    </div>
                )
            },
        },
        {
            accessorFn: (row) => (row as any).sous_famille?.libelle,
            id: "sous_famille",
            header: "Sous-Famille",
            cell: ({ row }) => (row.original as any).sous_famille?.libelle || "—",
        },
        {
            accessorKey: "prix_achat",
            header: "P. Achat",
            cell: ({ row }) => (
                <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {Number(row.original.prix_achat).toFixed(2)} DH
                </span>
            ),
        },
        {
            accessorKey: "prix_vente",
            header: "P. Vente",
            cell: ({ row }) => (
                <span className="font-mono text-xs font-bold text-foreground whitespace-nowrap">
                    {Number(row.original.prix_vente).toFixed(2)} DH
                </span>
            ),
        },
        {
            accessorKey: "stock_actuel",
            header: "Stock",
            cell: ({ row }) => {
                const stock = (row.original as any).stock_actuel ?? 0
                const seuil = row.original.seuil_alerte || 0
                const isOutOfStock = stock <= 0
                const isLowStock = stock <= seuil && !isOutOfStock

                return (
                    <Badge
                        variant="outline"
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap ${
                            isOutOfStock
                                ? "border-red-200 bg-red-50 text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-400"
                                : isLowStock
                                ? "border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-400"
                                : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400"
                        }`}
                    >
                        {stock} u.
                    </Badge>
                )
            },
        },
        {
            accessorFn: (row) => row.actif ? "Actif" : "Inactif",
            id: "actif",
            header: "Statut",
            cell: ({ row }) => (
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${row.original.actif ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${row.original.actif ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                    {row.original.actif ? "Actif" : "Inactif"}
                </span>
            ),
        },
        {
            id: "actions",
            enableSorting: false,
            cell: ({ row }) => {
                const article = row.original
                return (
                    <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                    <Link href={`/articles/${article.id}`}>
                                        <Eye className="mr-2 h-4 w-4" />
                                        Voir
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link href={`/articles/${article.id}/modifier`}>
                                        <Pencil className="mr-2 h-4 w-4" />
                                        Modifier
                                    </Link>
                                </DropdownMenuItem>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Supprimer
                                        </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Voulez-vous vraiment supprimer l&apos;article &quot;{article.designation}&quot; ?
                                                Cette action est irréversible.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDelete(article.id)}>
                                                Supprimer
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )
            },
        },
    ]

    if (isLoading) return <LoadingScreen />

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Articles</h2>
                    <p className="text-muted-foreground">
                        Gérez vos articles et votre catalogue de produits
                    </p>
                </div>
            </div>
            <DataTable
                columns={columns}
                data={articles || []}
                searchPlaceholder="Rechercher un article..."
                createUrl="/articles/nouveau"
                createLabel="Nouvel article"
                getRowHref={(row) => `/articles/${row.id}`}
                initialColumnVisibility={{
                    reference: false,
                    sous_famille: false,
                }}
            />
        </div>
    )
}
