"use client"

import { ColumnDef } from "@tanstack/react-table"
import { useBonLivraisonList, useDeleteBonLivraison, useUpdateBonLivraisonStatut, useToggleBonLivraisonTVA } from "@/hooks/use-bon-livraisons"
import { DataTable } from "@/components/data-table/data-table"
import type { BonLivraison } from "@/types/database"
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

const statutColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    brouillon: "secondary", valide: "default", annule: "destructive",
}
const statutLabels: Record<string, string> = {
    brouillon: "Brouillon", valide: "Validé", annule: "Annulé",
}

export default function BonLivraisonsPage() {
    const { data: bls, isLoading } = useBonLivraisonList()
    const deleteBL = useDeleteBonLivraison()
    const updateStatut = useUpdateBonLivraisonStatut()
    const { exportToExcel, isExporting } = useExportToExcel()

    const handleExport = (filteredRows: any[]) => {
        exportToExcel("bon_livraisons", `Export_Bon_Livraison_${new Date().toLocaleDateString("fr-FR").replace(/\//g, "-")}`, filteredRows)
    }

    const handleDelete = async (id: string) => {
        try { await deleteBL.mutateAsync(id); toast.success("Bon de livraison supprimé") } catch { toast.error("Erreur lors de la suppression") }
    }
    const handleValider = async (id: string) => {
        try { await updateStatut.mutateAsync({ id, statut: "valide" }); toast.success("Bon de livraison validé") } catch { toast.error("Erreur lors de la validation") }
    }

    const columns: ColumnDef<BonLivraison>[] = [
        { accessorKey: "numero", header: "N° BL" },
        { accessorKey: "date", header: "Date", cell: ({ row }) => new Date(row.original.date).toLocaleDateString("fr-FR") },
        { 
            accessorFn: (row) => row.client?.raison_sociale, 
            id: "client", 
            header: "Client", 
            cell: ({ row }) => (
                <div className="max-w-[200px] truncate font-medium text-xs text-foreground" title={row.original.client?.raison_sociale || ""}>
                    {row.original.client?.raison_sociale || "—"}
                </div>
            ) 
        },
        { 
            accessorFn: (row) => (row as any).depot?.libelle, 
            id: "depot", 
            header: "Dépôt", 
            cell: ({ row }) => (row.original as any).depot?.libelle || "—" 
        },
        { accessorKey: "montant_ttc", header: "Montant Total", cell: ({ row }) => `${Number(row.original.montant_ttc).toFixed(2)} MAD` },
        {
            accessorFn: (row) => statutLabels[row.statut] || row.statut,
            id: "statut", 
            header: "Statut",
            cell: ({ row }) => <Badge variant={statutColors[row.original.statut] || "secondary"}>{statutLabels[row.original.statut] || row.original.statut}</Badge>,
        },
        {
            id: "actions",
            enableSorting: false,
            cell: ({ row }) => {
                const bl = row.original
                return (
                    <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild><Link href={`/bon-livraisons/${bl.id}`}><Eye className="mr-2 h-4 w-4" />Voir</Link></DropdownMenuItem>
                                <DropdownMenuItem asChild><Link href={`/bon-livraisons/${bl.id}/modifier`}><Pencil className="mr-2 h-4 w-4" />Modifier</Link></DropdownMenuItem>
                                {bl.statut === "brouillon" && (
                                    <><DropdownMenuSeparator /><DropdownMenuItem onClick={() => handleValider(bl.id)}><CheckCircle className="mr-2 h-4 w-4 text-green-600" />Valider</DropdownMenuItem></>
                                )}
                                <DropdownMenuSeparator />
                                <AlertDialog>
                                    <AlertDialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()}><Trash2 className="mr-2 h-4 w-4" />Supprimer</DropdownMenuItem></AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader><AlertDialogTitle>Confirmer la suppression</AlertDialogTitle><AlertDialogDescription>Voulez-vous vraiment supprimer le BL {bl.numero} ?</AlertDialogDescription></AlertDialogHeader>
                                        <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(bl.id)}>Supprimer</AlertDialogAction></AlertDialogFooter>
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
            <div><h2 className="text-3xl font-bold tracking-tight">Bons de livraison</h2><p className="text-muted-foreground">Gérez vos bons de livraison</p></div>
            <DataTable 
                columns={columns} 
                data={bls || []} 
                searchPlaceholder="Rechercher un bon de livraison..." 
                createUrl="/bon-livraisons/nouveau" 
                createLabel="Nouveau BL"
                getRowHref={(row) => `/bon-livraisons/${row.id}`}
                onExportExcel={handleExport}
                exportingExcel={isExporting}
            />
        </div>
    )
}
