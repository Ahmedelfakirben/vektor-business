"use client"

import { ColumnDef } from "@tanstack/react-table"
import { useDepots, useDeleteDepot } from "@/hooks/use-depots"
import { DataTable } from "@/components/data-table/data-table"
import type { Depot } from "@/types/database"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, Pencil, Trash2, Eye } from "lucide-react"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import Link from "next/link"
import { toast } from "sonner"
import { LoadingScreen } from "@/components/ui/loading-screen"

export default function DepotsPage() {
    const { data: depots, isLoading } = useDepots()
    const deleteDepot = useDeleteDepot()

    const handleDelete = async (id: string) => {
        try {
            await deleteDepot.mutateAsync(id)
            toast.success("Dépôt supprimé avec succès")
        } catch {
            toast.error("Erreur lors de la suppression du dépôt")
        }
    }

    const columns: ColumnDef<Depot>[] = [
        { accessorKey: "code", header: "Code" },
        { accessorKey: "libelle", header: "Libellé" },
        { accessorKey: "adresse", header: "Adresse", cell: ({ row }) => row.original.adresse || "—" },
        {
            accessorKey: "responsable",
            header: "Responsable",
            cell: ({ row }) => {
                const r = (row.original as any).responsable
                return r ? `${r.prenom} ${r.nom}` : "—"
            },
        },
        {
            id: "actions",
            enableSorting: false,
            cell: ({ row }) => {
                const depot = row.original
                return (
                    <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild><Link href={`/depots/${depot.id}`}><Eye className="mr-2 h-4 w-4" />Voir</Link></DropdownMenuItem>
                                <DropdownMenuItem asChild><Link href={`/depots/${depot.id}/modifier`}><Pencil className="mr-2 h-4 w-4" />Modifier</Link></DropdownMenuItem>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}><Trash2 className="mr-2 h-4 w-4" />Supprimer</DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                                            <AlertDialogDescription>Voulez-vous vraiment supprimer le dépôt &quot;{depot.libelle}&quot; ? Cette action est irréversible.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDelete(depot.id)}>Supprimer</AlertDialogAction>
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
                <h2 className="text-3xl font-bold tracking-tight">Dépôts</h2>
                <p className="text-muted-foreground">Gérez vos dépôts de stockage</p>
            </div>
            <DataTable 
                columns={columns} 
                data={depots || []} 
                searchPlaceholder="Rechercher un dépôt..." 
                createUrl="/depots/nouveau" 
                createLabel="Nouveau dépôt"
                getRowHref={(row) => `/depots/${row.id}`}
            />
        </div>
    )
}
