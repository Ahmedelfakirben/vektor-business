"use client"

import { ColumnDef } from "@tanstack/react-table"
import { useTresoreries, useDeleteTresorerie } from "@/hooks/use-tresoreries"
import { DataTable } from "@/components/data-table/data-table"
import type { Tresorerie } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MoreHorizontal, Pencil, Trash2, Eye, Wallet } from "lucide-react"
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
import { useFiscalMode } from "@/providers/fiscal-mode-context"

export default function TresoreriesPage() {
    const { data: tresoreries, isLoading } = useTresoreries()
    const deleteTresorerie = useDeleteTresorerie()
    const { fiscalMode } = useFiscalMode()

    const handleDelete = async (id: string) => {
        try {
            await deleteTresorerie.mutateAsync(id)
            toast.success("Trésorerie supprimée avec succès")
        } catch {
            toast.error("Erreur lors de la suppression de la trésorerie")
        }
    }

    const columns: ColumnDef<Tresorerie>[] = [
        { accessorKey: "code", header: "Code" },
        { accessorKey: "libelle", header: "Libellé" },
        {
            accessorKey: "type",
            header: "Type",
            cell: ({ row }) => (
                <Badge variant={row.original.type === "banque" ? "default" : "secondary"}>
                    {row.original.type === "banque" ? "Banque" : "Caisse"}
                </Badge>
            ),
        },
        {
            accessorKey: "solde",
            header: fiscalMode ? "Solde Fiscal" : "Solde",
            cell: ({ row }) => {
                const solde = fiscalMode 
                    ? (row.original as any).solde_fiscale ?? 0 
                    : row.original.solde
                
                return (
                    <div className={`font-bold ${fiscalMode ? "text-amber-600" : ""}`}>
                        {Number(solde).toFixed(2)} DH
                    </div>
                )
            },
        },
        {
            id: "actions",
            enableSorting: false,
            cell: ({ row }) => {
                const tresorerie = row.original
                return (
                    <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild><Link href={`/tresoreries/${tresorerie.id}`}><Eye className="mr-2 h-4 w-4" />Voir</Link></DropdownMenuItem>
                                <DropdownMenuItem asChild><Link href={`/tresoreries/${tresorerie.id}/modifier`}><Pencil className="mr-2 h-4 w-4" />Modifier</Link></DropdownMenuItem>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}><Trash2 className="mr-2 h-4 w-4" />Supprimer</DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                                            <AlertDialogDescription>Voulez-vous vraiment supprimer la trésorerie &quot;{tresorerie.libelle}&quot; ? Cette action est irréversible.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDelete(tresorerie.id)}>Supprimer</AlertDialogAction>
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
            <div className="flex justify-between items-center">
                <div>
                    <h2 className={`text-3xl font-bold tracking-tight ${fiscalMode ? "text-amber-500" : ""}`}>
                        {fiscalMode ? "Trésoreries Facturées" : "Trésoreries"}
                    </h2>
                    <p className="text-muted-foreground">
                        {fiscalMode ? "États de trésorerie basés uniquement sur les règlements facturés" : "Gérez vos caisses et comptes bancaires globaux"}
                    </p>
                </div>
                {fiscalMode && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 font-bold text-sm">
                        <Wallet className="h-4 w-4" />
                        Mode Fiscal Actif
                    </div>
                )}
            </div>
            <DataTable 
                columns={columns} 
                data={tresoreries || []} 
                searchPlaceholder="Rechercher une trésorerie..." 
                createUrl="/tresoreries/nouveau" 
                createLabel="Nouvelle trésorerie"
                getRowHref={(row) => `/tresoreries/${row.id}`}
            />
        </div>
    )
}
