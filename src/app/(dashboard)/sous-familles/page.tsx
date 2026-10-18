"use client"

import { useState } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { useSousFamilles, useDeleteSousFamille, useCreateSousFamille, useUpdateSousFamille } from "@/hooks/use-sous-familles"
import { useFamilles } from "@/hooks/use-familles"
import { DataTable } from "@/components/data-table/data-table"
import type { SousFamilleArticle } from "@/types/database"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, Pencil, Trash2, Layers, Plus } from "lucide-react"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { LoadingScreen } from "@/components/ui/loading-screen"
import { Badge } from "@/components/ui/badge"

export default function SousFamillesPage() {
    const { data: sousFamilles, isLoading } = useSousFamilles()
    const { data: familles } = useFamilles()
    const deleteSousFamille = useDeleteSousFamille()
    const createSousFamille = useCreateSousFamille()
    const updateSousFamille = useUpdateSousFamille()

    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingSousFamille, setEditingSousFamille] = useState<SousFamilleArticle | null>(null)
    const [formData, setFormData] = useState({
        libelle: "",
        famille_id: "",
        type_code_requis: "",
        description: "",
    })

    const handleOpenDialog = (sf: SousFamilleArticle | null = null) => {
        if (sf) {
            setEditingSousFamille(sf)
            setFormData({
                libelle: sf.libelle,
                famille_id: sf.famille_id,
                type_code_requis: sf.type_code_requis || "",
                description: sf.description || "",
            })
        } else {
            setEditingSousFamille(null)
            setFormData({ libelle: "", famille_id: "", type_code_requis: "", description: "" })
        }
        setIsDialogOpen(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            if (editingSousFamille) {
                await updateSousFamille.mutateAsync({ id: editingSousFamille.id, ...formData })
                toast.success("Sous-famille mise à jour")
            } else {
                await createSousFamille.mutateAsync(formData)
                toast.success("Sous-famille créée")
            }
            setIsDialogOpen(false)
        } catch {
            toast.error("Une erreur est survenue")
        }
    }

    const handleDelete = async (id: string) => {
        try {
            await deleteSousFamille.mutateAsync(id)
            toast.success("Sous-famille supprimée")
        } catch {
            toast.error("Erreur lors de la suppression")
        }
    }

    const columns: ColumnDef<SousFamilleArticle>[] = [
        { accessorKey: "libelle", header: "Sous-Famille" },
        { 
            accessorFn: (row) => row.famille?.libelle,
            id: "famille",
            header: "Famille Parente",
            cell: ({ row }) => <Badge variant="outline">{row.original.famille?.libelle || "—"}</Badge>
        },
        { 
            accessorKey: "type_code_requis", 
            header: "Code Requis", 
            cell: ({ row }) => row.original.type_code_requis ? (
                <div className="flex items-center gap-2">
                    <span className="text-orange-600 font-bold text-xs">Exige:</span>
                    <Badge variant="secondary" className="bg-orange-500/10 text-orange-600 border-orange-500/20">{row.original.type_code_requis}</Badge>
                </div>
            ) : "Aucun"
        },
        {
            id: "actions",
            enableSorting: false,
            cell: ({ row }) => {
                const sf = row.original
                return (
                    <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleOpenDialog(sf)}><Pencil className="mr-2 h-4 w-4" />Modifier</DropdownMenuItem>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Supprimer</DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                                            <AlertDialogDescription>Supprimer la sous-famille &quot;{sf.libelle}&quot; ?</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDelete(sf.id)}>Supprimer</AlertDialogAction>
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
                    <h2 className="text-3xl font-bold tracking-tight">Sous-Familles d&apos;articles</h2>
                    <p className="text-muted-foreground">Divisions par catégories de vos articles</p>
                </div>
                <Button onClick={() => handleOpenDialog()} className="bg-orange-600 hover:bg-orange-700">
                    <Plus className="mr-2 h-4 w-4" /> Nouvelle Sous-Famille
                </Button>
            </div>

            <DataTable columns={columns} data={sousFamilles || []} searchPlaceholder="Rechercher una sous-famille..." />

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <form onSubmit={handleSubmit}>
                        <DialogHeader>
                            <DialogTitle>{editingSousFamille ? "Modifier" : "Nouvelle"} Sous-Famille</DialogTitle>
                            <DialogDescription>Définissez une sous-catégorie et configurez la traçabilidad por código.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="famille">Famille Parente</Label>
                                <Select value={formData.famille_id} onValueChange={(v) => setFormData({...formData, famille_id: v})}>
                                    <SelectTrigger><SelectValue placeholder="Sélectionner une famille" /></SelectTrigger>
                                    <SelectContent>
                                        {familles?.map((f) => <SelectItem key={f.id} value={f.id}>{f.libelle}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="libelle">Nom de la Sous-Famille</Label>
                                <Input id="libelle" value={formData.libelle} onChange={(e) => setFormData({...formData, libelle: e.target.value})} placeholder="ex: Smartphones, Laptops..." required />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="code_requis">Type de Code Requis (Gestion de Trazabilidad)</Label>
                                <Input id="code_requis" value={formData.type_code_requis} onChange={(e) => setFormData({...formData, type_code_requis: e.target.value})} placeholder="ex: IMEI, N° de Série, Batch... (Laisse vide si non requis)" />
                                <p className="text-[11px] text-muted-foreground">Si vous remplissez ce campo, un código será solicitado obligatoriamente lors de cada BL o BA para los artículos de esta sub-familia.</p>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                            <Button type="submit" className="bg-orange-600 hover:bg-orange-700">{editingSousFamille ? "Mettre à jour" : "Créer"}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
