"use client"

import { ColumnDef } from "@tanstack/react-table"
import { useBonRetourAchatList, useDeleteBonRetourAchat, useUpdateBonRetourAchatStatut, useToggleBonRetourAchatTVA } from "@/hooks/use-bon-retour-achats"
import { DataTable } from "@/components/data-table/data-table"
import type { BonRetourAchat } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MoreHorizontal, Pencil, Trash2, Eye, CheckCircle, FileText } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import Link from "next/link"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { useExportToExcel } from "@/hooks/use-export-excel"

const statutColors: Record<string, "default" | "secondary" | "destructive"> = { brouillon: "secondary", valide: "default", annule: "destructive" }
const statutLabels: Record<string, string> = { brouillon: "Brouillon", valide: "Validé", annule: "Annulé" }

export default function BonRetourAchatsPage() {
    const { data: bras, isLoading } = useBonRetourAchatList()
    const deleteBRA = useDeleteBonRetourAchat()
    const updateStatut = useUpdateBonRetourAchatStatut()
    const { exportToExcel, isExporting } = useExportToExcel()

    const handleExport = (filteredRows: any[]) => {
        exportToExcel("bon_retour_achats", `Export_Bon_Retour_Achat_${new Date().toLocaleDateString("fr-FR").replace(/\//g, "-")}`, filteredRows)
    }

    const handleDelete = async (id: string) => { try { await deleteBRA.mutateAsync(id); toast.success("Bon de retour achat supprimé") } catch { toast.error("Erreur lors de la suppression") } }

    const columns: ColumnDef<BonRetourAchat>[] = [
        { accessorKey: "numero", header: "N° BRA" },
        { accessorKey: "date", header: "Date", cell: ({ row }) => new Date(row.original.date).toLocaleDateString("fr-FR") },
        { accessorKey: "fournisseur", header: "Fournisseur", cell: ({ row }) => row.original.fournisseur?.raison_sociale || "—" },
        { accessorKey: "motif", header: "Motif", cell: ({ row }) => row.original.motif || "—" },
        { accessorKey: "montant_ttc", header: "Montant Total", cell: ({ row }) => `${Number(row.original.montant_ttc).toFixed(2)} MAD` },
        { accessorKey: "statut", header: "Statut", cell: ({ row }) => <Badge variant={statutColors[row.original.statut] || "secondary"}>{statutLabels[row.original.statut] || row.original.statut}</Badge> },
        {
            id: "actions",
            enableSorting: false,
            cell: ({ row }) => {
                const bra = row.original
                return (
                    <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild><Link href={`/bon-retour-achats/${bra.id}`}><Eye className="mr-2 h-4 w-4" />Voir</Link></DropdownMenuItem>
                                <DropdownMenuItem asChild><Link href={`/bon-retour-achats/${bra.id}/modifier`}><Pencil className="mr-2 h-4 w-4" />Modifier</Link></DropdownMenuItem>
                                {bra.statut === "brouillon" && (<><DropdownMenuSeparator /><DropdownMenuItem onClick={() => updateStatut.mutateAsync({ id: bra.id, statut: "valide" }).then(() => toast.success("BRA validé")).catch(() => toast.error("Erreur"))}><CheckCircle className="mr-2 h-4 w-4 text-green-600" />Valider</DropdownMenuItem></>)}
                                <DropdownMenuSeparator />
                                <AlertDialog>
                                    <AlertDialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()}><Trash2 className="mr-2 h-4 w-4" />Supprimer</DropdownMenuItem></AlertDialogTrigger>
                                    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirmer la suppression</AlertDialogTitle><AlertDialogDescription>Supprimer le BRA {bra.numero} ?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(bra.id)}>Supprimer</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                                </AlertDialog>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )
            },
        },
    ]

    if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96 w-full" /></div>
    return (
        <div className="space-y-6">
            <div><h2 className="text-3xl font-bold tracking-tight">Bons de retour achat</h2><p className="text-muted-foreground">Gérez vos retours fournisseurs</p></div>
            <DataTable 
                columns={columns} 
                data={bras || []} 
                searchPlaceholder="Rechercher un bon de retour achat..." 
                createUrl="/bon-retour-achats/nouveau" 
                createLabel="Nouveau BRA"
                getRowHref={(row) => `/bon-retour-achats/${row.id}`}
                onExportExcel={handleExport}
                exportingExcel={isExporting}
            />
        </div>
    )
}
