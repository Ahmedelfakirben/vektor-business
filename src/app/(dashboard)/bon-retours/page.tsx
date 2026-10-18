"use client"

import { ColumnDef } from "@tanstack/react-table"
import { useBonRetourList, useDeleteBonRetour, useUpdateBonRetourStatut, useToggleBonRetourTVA } from "@/hooks/use-bon-retours"
import { DataTable } from "@/components/data-table/data-table"
import type { BonRetour } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MoreHorizontal, Pencil, Trash2, Eye, CheckCircle, FileText } from "lucide-react"
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

const statutColors: Record<string, "default" | "secondary" | "destructive"> = { brouillon: "secondary", valide: "default", annule: "destructive" }
const statutLabels: Record<string, string> = { brouillon: "Brouillon", valide: "Validé", annule: "Annulé" }

export default function BonRetoursPage() {
    const { data: brs, isLoading } = useBonRetourList()
    const deleteBR = useDeleteBonRetour()
    const updateStatut = useUpdateBonRetourStatut()
    const { exportToExcel, isExporting } = useExportToExcel()

    const handleExport = (filteredRows: any[]) => {
        exportToExcel("bon_retours", `Export_Bon_Retour_${new Date().toLocaleDateString("fr-FR").replace(/\//g, "-")}`, filteredRows)
    }

    const handleDelete = async (id: string) => {
        try { await deleteBR.mutateAsync(id); toast.success("Bon de retour supprimé") } catch { toast.error("Erreur lors de la suppression") }
    }
    const handleValider = async (id: string) => {
        try { await updateStatut.mutateAsync({ id, statut: "valide" }); toast.success("Bon de retour validé") } catch { toast.error("Erreur lors de la validation") }
    }

    const columns: ColumnDef<BonRetour>[] = [
        { accessorKey: "numero", header: "N° BR" },
        { accessorKey: "date", header: "Date", cell: ({ row }) => new Date(row.original.date).toLocaleDateString("fr-FR") },
        { accessorKey: "client", header: "Client", cell: ({ row }) => row.original.client?.raison_sociale || "—" },
        { accessorKey: "motif", header: "Motif", cell: ({ row }) => row.original.motif || "—" },
        { accessorKey: "montant_ttc", header: "Montant Total", cell: ({ row }) => `${Number(row.original.montant_ttc).toFixed(2)} MAD` },
        {
            accessorKey: "statut", header: "Statut",
            cell: ({ row }) => <Badge variant={statutColors[row.original.statut] || "secondary"}>{statutLabels[row.original.statut] || row.original.statut}</Badge>,
        },
        {
            id: "actions",
            enableSorting: false,
            cell: ({ row }) => {
                const br = row.original
                return (
                    <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild><Link href={`/bon-retours/${br.id}`}><Eye className="mr-2 h-4 w-4" />Voir</Link></DropdownMenuItem>
                                <DropdownMenuItem asChild><Link href={`/bon-retours/${br.id}/modifier`}><Pencil className="mr-2 h-4 w-4" />Modifier</Link></DropdownMenuItem>
                                {br.statut === "brouillon" && (
                                    <><DropdownMenuSeparator /><DropdownMenuItem onClick={() => handleValider(br.id)}><CheckCircle className="mr-2 h-4 w-4 text-green-600" />Valider</DropdownMenuItem></>
                                )}
                                <DropdownMenuSeparator />
                                <AlertDialog>
                                    <AlertDialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()}><Trash2 className="mr-2 h-4 w-4" />Supprimer</DropdownMenuItem></AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader><AlertDialogTitle>Confirmer la suppression</AlertDialogTitle><AlertDialogDescription>Voulez-vous vraiment supprimer le BR {br.numero} ?</AlertDialogDescription></AlertDialogHeader>
                                        <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(br.id)}>Supprimer</AlertDialogAction></AlertDialogFooter>
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
            <div><h2 className="text-3xl font-bold tracking-tight">Bons de retour</h2><p className="text-muted-foreground">Gérez vos retours de marchandise</p></div>
            <DataTable 
                columns={columns} 
                data={brs || []} 
                searchPlaceholder="Rechercher un bon de retour..." 
                createUrl="/bon-retours/nouveau" 
                createLabel="Nouveau BR"
                getRowHref={(row) => `/bon-retours/${row.id}`}
                onExportExcel={handleExport}
                exportingExcel={isExporting}
            />
        </div>
    )
}
