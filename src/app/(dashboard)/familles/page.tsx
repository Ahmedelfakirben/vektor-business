"use client"

import { ColumnDef } from "@tanstack/react-table"
import { useFamilles, useDeleteFamille } from "@/hooks/use-familles"
import { DataTable } from "@/components/data-table/data-table"
import type { FamilleArticle } from "@/types/database"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, Pencil, Trash2, Eye } from "lucide-react"
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

export default function FamillesPage() {
    const { data: familles, isLoading } = useFamilles()
    const deleteFamille = useDeleteFamille()

    const handleDelete = async (id: string) => {
        try {
            await deleteFamille.mutateAsync(id)
            toast.success("Famille supprimée avec succès")
        } catch {
            toast.error("Erreur lors de la suppression de la famille")
        }
    }

    const columns: ColumnDef<FamilleArticle>[] = [
        { accessorKey: "code", header: "Code" },
        { accessorKey: "libelle", header: "Libellé" },
        { accessorKey: "description", header: "Description", cell: ({ row }) => row.original.description || "—" },
        {
            id: "actions",
            enableSorting: false,
            cell: ({ row }) => {
                const famille = row.original
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
                                    <Link href={`/familles/${famille.id}`}>
                                        <Eye className="mr-2 h-4 w-4" />
                                        Voir
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link href={`/familles/${famille.id}/modifier`}>
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
                                                Voulez-vous vraiment supprimer la famille &quot;{famille.libelle}&quot; ?
                                                Cette action est irréversible.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDelete(famille.id)}>
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
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Familles d&apos;articles</h2>
                <p className="text-muted-foreground">Gérez les familles de vos articles</p>
            </div>
            <DataTable
                columns={columns}
                data={familles || []}
                searchPlaceholder="Rechercher un famille..."
                createUrl="/familles/nouveau"
                createLabel="Nouvelle famille"
                getRowHref={(row) => `/familles/${row.id}`}
            />
        </div>
    )
}
