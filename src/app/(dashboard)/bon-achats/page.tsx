"use client"

import { ColumnDef } from "@tanstack/react-table"
import { useBonAchatList, useDeleteBonAchat, useUpdateBonAchatStatut, useToggleBonAchatTVA } from "@/hooks/use-bon-achats"
import { DataTable } from "@/components/data-table/data-table"
import type { BonAchat } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MoreHorizontal, Pencil, Trash2, Eye, CheckCircle, FileText } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import Link from "next/link"
import { toast } from "sonner"
import { LoadingScreen } from "@/components/ui/loading-screen"
import { useExportToExcel } from "@/hooks/use-export-excel"

const statutColors: Record<string, "default" | "secondary" | "destructive"> = { brouillon: "secondary", valide: "default", annule: "destructive" }
const statutLabels: Record<string, string> = { brouillon: "Brouillon", valide: "Validé", annule: "Annulé" }

export default function BonAchatsPage() {
    const { data: bas, isLoading } = useBonAchatList()
    const deleteBA = useDeleteBonAchat()
    const updateStatut = useUpdateBonAchatStatut()
    const { exportToExcel, isExporting } = useExportToExcel()

    const handleExport = (filteredRows: any[]) => {
        exportToExcel("bon_achats", `Export_Bon_Achat_${new Date().toLocaleDateString("fr-FR").replace(/\//g, "-")}`, filteredRows)
    }

    const handleDelete = async (id: string) => { try { await deleteBA.mutateAsync(id); toast.success("Bon d'achat supprimé") } catch { toast.error("Erreur lors de la suppression") } }

    const columns: ColumnDef<BonAchat>[] = [
        { accessorKey: "numero", header: "N° BA" },
        { accessorKey: "date", header: "Date", cell: ({ row }) => new Date(row.original.date).toLocaleDateString("fr-FR") },
        { 
            accessorFn: (row) => row.fournisseur?.raison_sociale, 
            id: "fournisseur", 
            header: "Fournisseur", 
            cell: ({ row }) => (
                <div className="max-w-[200px] truncate font-medium text-xs text-foreground" title={row.original.fournisseur?.raison_sociale || ""}>
                    {row.original.fournisseur?.raison_sociale || "—"}
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
        { accessorKey: "statut", header: "Statut", cell: ({ row }) => <Badge variant={statutColors[row.original.statut] || "secondary"}>{statutLabels[row.original.statut] || row.original.statut}</Badge> },
        {
            id: "actions",
            enableSorting: false,
            cell: ({ row }) => {
                const ba = row.original
                return (
                    <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild><Link href={`/bon-achats/${ba.id}`}><Eye className="mr-2 h-4 w-4" />Voir</Link></DropdownMenuItem>
                                <DropdownMenuItem asChild><Link href={`/bon-achats/${ba.id}/modifier`}><Pencil className="mr-2 h-4 w-4" />Modifier</Link></DropdownMenuItem>
                                {ba.statut === "brouillon" && (<><DropdownMenuSeparator /><DropdownMenuItem onClick={() => updateStatut.mutateAsync({ id: ba.id, statut: "valide" }).then(() => toast.success("Bon d'achat validé")).catch(() => toast.error("Erreur"))}><CheckCircle className="mr-2 h-4 w-4 text-green-600" />Valider</DropdownMenuItem></>)}
                                <DropdownMenuSeparator />
                                <AlertDialog>
                                    <AlertDialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()}><Trash2 className="mr-2 h-4 w-4" />Supprimer</DropdownMenuItem></AlertDialogTrigger>
                                    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirmer la suppression</AlertDialogTitle><AlertDialogDescription>Supprimer le BA {ba.numero} ?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(ba.id)}>Supprimer</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
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
            <div><h2 className="text-3xl font-bold tracking-tight">Bons d&apos;achat</h2><p className="text-muted-foreground">Gérez vos réceptions fournisseurs</p></div>
            <DataTable 
                columns={columns} 
                data={bas || []} 
                searchPlaceholder="Rechercher un bon d'achat..." 
                createUrl="/bon-achats/nouveau" 
                createLabel="Nouveau BA"
                getRowHref={(row) => `/bon-achats/${row.id}`}
                onExportExcel={handleExport}
                exportingExcel={isExporting}
            />
        </div>
    )
}
