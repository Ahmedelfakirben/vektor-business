"use client"

import { ColumnDef } from "@tanstack/react-table"
import { useDevisList, useDeleteDevis, useUpdateDevisStatut, useToggleDevisTVA } from "@/hooks/use-devis"
import { DataTable } from "@/components/data-table/data-table"
import type { Devis } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MoreHorizontal, Pencil, Trash2, Eye, CheckCircle, XCircle, FileText } from "lucide-react"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import Link from "next/link"
import { toast } from "sonner"
import { LoadingScreen } from "@/components/ui/loading-screen"
import { useExportToExcel } from "@/hooks/use-export-excel"

const statutColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    brouillon: "secondary",
    envoye: "outline",
    accepte: "default",
    refuse: "destructive",
    expire: "destructive",
}

const statutLabels: Record<string, string> = {
    brouillon: "Brouillon",
    envoye: "Envoyé",
    accepte: "Accepté",
    refuse: "Refusé",
    expire: "Expiré",
}

export default function DevisListPage() {
    const { data: devisList, isLoading } = useDevisList()
    const deleteDevis = useDeleteDevis()
    const updateStatut = useUpdateDevisStatut()
    const { exportToExcel, isExporting } = useExportToExcel()

    const handleExport = (filteredRows: any[]) => {
        exportToExcel("devis", `Export_Devis_${new Date().toLocaleDateString("fr-FR").replace(/\//g, "-")}`, filteredRows)
    }

    const handleDelete = async (id: string) => {
        try {
            await deleteDevis.mutateAsync(id)
            toast.success("Devis supprimé avec succès")
        } catch {
            toast.error("Erreur lors de la suppression du devis")
        }
    }

    const handleStatut = async (id: string, statut: string) => {
        try {
            await updateStatut.mutateAsync({ id, statut })
            toast.success(`Devis marqué comme ${statutLabels[statut]?.toLowerCase()}`)
        } catch (error: any) {
            console.error("Erreur changement statut:", error)
            toast.error(error.message || "Erreur lors du changement de statut")
        }
    }

    const columns: ColumnDef<Devis>[] = [
        {
            accessorKey: "numero",
            header: "Numéro",
            cell: ({ row }) => (
                <Link href={`/devis/${row.original.id}`} className="font-medium hover:underline text-primary">
                    {row.original.numero}
                </Link>
            ),
        },
        {
            accessorKey: "date",
            header: "Date",
            cell: ({ row }) => new Date(row.original.date).toLocaleDateString("fr-FR"),
        },
        {
            id: "client",
            header: "Client",
            cell: ({ row }) => (
                <div className="max-w-[200px] truncate font-medium text-xs text-foreground" title={row.original.client?.raison_sociale || ""}>
                    {row.original.client?.raison_sociale || "—"}
                </div>
            ),
        },
        {
            accessorKey: "montant_ttc",
            header: "Montant Total",
            cell: ({ row }) => `${Number(row.original.montant_ttc).toFixed(2)} MAD`,
        },
        {
            accessorKey: "statut",
            header: "Statut",
            cell: ({ row }) => (
                <Badge variant={statutColors[row.original.statut] || "secondary"}>
                    {statutLabels[row.original.statut] || row.original.statut}
                </Badge>
            ),
        },
        {
            id: "actions",
            enableSorting: false,
            cell: ({ row }) => {
                const devis = row.original
                return (
                    <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild><Link href={`/devis/${devis.id}`}><Eye className="mr-2 h-4 w-4" />Voir</Link></DropdownMenuItem>
                                <DropdownMenuItem asChild><Link href={`/devis/${devis.id}/modifier`}><Pencil className="mr-2 h-4 w-4" />Modifier</Link></DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {devis.statut === "brouillon" && (
                                    <DropdownMenuItem onClick={() => handleStatut(devis.id, "envoye")}>
                                        <CheckCircle className="mr-2 h-4 w-4" />Marquer envoyé
                                    </DropdownMenuItem>
                                )}
                                {devis.statut === "envoye" && (
                                    <>
                                        <DropdownMenuItem onClick={() => handleStatut(devis.id, "accepte")}>
                                            <CheckCircle className="mr-2 h-4 w-4 text-green-600" />Accepter
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleStatut(devis.id, "refuse")}>
                                            <XCircle className="mr-2 h-4 w-4 text-red-600" />Refuser
                                        </DropdownMenuItem>
                                    </>
                                )}
                                <DropdownMenuSeparator />
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}><Trash2 className="mr-2 h-4 w-4" />Supprimer</DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                                            <AlertDialogDescription>Voulez-vous vraiment supprimer le devis {devis.numero} ? Cette action est irréversible.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDelete(devis.id)}>Supprimer</AlertDialogAction>
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
                <h2 className="text-3xl font-bold tracking-tight">Devis</h2>
                <p className="text-muted-foreground">Gérez vos devis clients</p>
            </div>
            <DataTable 
                columns={columns} 
                data={devisList || []} 
                searchPlaceholder="Rechercher un devis..." 
                createUrl="/devis/nouveau" 
                createLabel="Nouveau devis"
                getRowHref={(row) => `/devis/${row.id}`}
                onExportExcel={handleExport}
                exportingExcel={isExporting}
            />
        </div>
    )
}
