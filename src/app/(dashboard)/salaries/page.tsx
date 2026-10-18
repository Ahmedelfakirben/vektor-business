"use client"

import { ColumnDef } from "@tanstack/react-table"
import { useSalaries, useDeleteSalarie } from "@/hooks/use-salaries"
import { DataTable } from "@/components/data-table/data-table"
import type { Salarie } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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

export default function SalariesPage() {
    const { data: salaries, isLoading } = useSalaries()
    const deleteSalarie = useDeleteSalarie()

    const handleDelete = async (id: string) => {
        try {
            await deleteSalarie.mutateAsync(id)
            toast.success("Salarié supprimé avec succès")
        } catch {
            toast.error("Erreur lors de la suppression du salarié")
        }
    }

    const columns: ColumnDef<Salarie>[] = [
        { accessorKey: "matricule", header: "Matricule" },
        { accessorKey: "nom", header: "Nom" },
        { accessorKey: "prenom", header: "Prénom" },
        { accessorKey: "poste", header: "Poste", cell: ({ row }) => row.original.poste || "—" },
        { accessorKey: "telephone", header: "Téléphone", cell: ({ row }) => row.original.telephone || "—" },
        {
            accessorKey: "actif",
            header: "Statut",
            cell: ({ row }) => (
                <Badge variant={row.original.actif ? "default" : "secondary"}>
                    {row.original.actif ? "Actif" : "Inactif"}
                </Badge>
            ),
        },
        {
            id: "actions",
            enableSorting: false,
            cell: ({ row }) => {
                const salarie = row.original
                return (
                    <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild><Link href={`/salaries/${salarie.id}`}><Eye className="mr-2 h-4 w-4" />Voir</Link></DropdownMenuItem>
                                <DropdownMenuItem asChild><Link href={`/salaries/${salarie.id}/modifier`}><Pencil className="mr-2 h-4 w-4" />Modifier</Link></DropdownMenuItem>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}><Trash2 className="mr-2 h-4 w-4" />Supprimer</DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                                            <AlertDialogDescription>Voulez-vous vraiment supprimer le salarié &quot;{salarie.prenom} {salarie.nom}&quot; ? Cette action est irréversible.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDelete(salarie.id)}>Supprimer</AlertDialogAction>
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
                <h2 className="text-3xl font-bold tracking-tight">Salariés</h2>
                <p className="text-muted-foreground">Gérez vos employés</p>
            </div>
            <DataTable 
                columns={columns} 
                data={salaries || []} 
                searchPlaceholder="Rechercher un salarié..." 
                createUrl="/salaries/nouveau" 
                createLabel="Nouveau salarié"
                getRowHref={(row) => `/salaries/${row.id}`}
            />
        </div>
    )
}
