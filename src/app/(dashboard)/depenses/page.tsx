"use client"

import { useState } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { useDepenses, useCreateDepense, useDeleteDepense } from "@/hooks/use-depenses"
import { useTresoreries } from "@/hooks/use-tresoreries"
import { DataTable } from "@/components/data-table/data-table"
import type { Depense } from "@/types/database"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, Trash2, Wallet, Plus, Calendar, ReceiptText } from "lucide-react"
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
import { Switch } from "@/components/ui/switch"

const CATEGORIES = ["Loyer", "Salaire", "Internet", "Electricité", "Eau", "Fournitures", "Autre"]

export default function DepensesPage() {
    const { data: depenses, isLoading } = useDepenses()
    const { data: tresoreries } = useTresoreries()
    const createDepense = useCreateDepense()
    const deleteDepense = useDeleteDepense()

    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [formData, setFormData] = useState({
        numero: `DEP-${Date.now().toString().slice(-6)}`,
        date: new Date().toISOString().split('T')[0],
        categorie: "",
        montant: 0,
        tresorerie_id: "",
        notes: "",
        inclure_tva: false,
    })

    const handleOpenDialog = () => {
        setFormData({
            numero: `DEP-${Date.now().toString().slice(-6)}`,
            date: new Date().toISOString().split('T')[0],
            categorie: "",
            montant: 0,
            tresorerie_id: "",
            notes: "",
            inclure_tva: false,
        })
        setIsDialogOpen(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.tresorerie_id) {
            toast.error("Veuillez sélectionner une trésorerie")
            return
        }
        try {
            await createDepense.mutateAsync(formData)
            toast.success("Dépense enregistrée avec éxito")
            setIsDialogOpen(false)
        } catch {
            toast.error("Une erreur est survenue")
        }
    }

    const handleDelete = async (id: string) => {
        try {
            await deleteDepense.mutateAsync(id)
            toast.success("Dépense supprimée")
        } catch {
            toast.error("Erreur lors de la suppression")
        }
    }

    const columns: ColumnDef<Depense>[] = [
        { accessorKey: "numero", header: "N°" },
        { 
            accessorKey: "date", 
            header: "Date",
            cell: ({ row }) => new Date(row.original.date).toLocaleDateString("fr-FR")
        },
        { 
            accessorKey: "categorie", 
            header: "Catégorie",
            cell: ({ row }) => <Badge variant="secondary">{row.original.categorie}</Badge>
        },
        { 
            accessorFn: (row) => row.tresorerie?.libelle,
            id: "tresorerie",
            header: "Payé via",
            cell: ({ row }) => <div className="text-sm font-medium">{row.original.tresorerie?.libelle || "—"}</div>
        },
        { 
            accessorKey: "montant", 
            header: "Montant",
            cell: ({ row }) => <span className="font-bold text-destructive">-{Number(row.original.montant).toFixed(2)} DH</span>
        },
        {
            accessorKey: "inclure_tva",
            header: "Fiscal",
            cell: ({ row }) => row.original.inclure_tva ? (
                <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Facturé</Badge>
            ) : "—"
        },
        {
            id: "actions",
            enableSorting: false,
            cell: ({ row }) => {
                const depense = row.original
                return (
                    <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Supprimer</DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                                            <AlertDialogDescription>Cela annulera le mouvement en trésorerie. Continuer?</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDelete(depense.id)}>Supprimer</AlertDialogAction>
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
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
                        <Wallet className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Dépenses Opérationnelles</h2>
                        <p className="text-muted-foreground">Gestion de los gastos (alquiler, salarios, etc.)</p>
                    </div>
                </div>
                <Button onClick={handleOpenDialog} className="bg-destructive hover:bg-destructive/90">
                    <Plus className="mr-2 h-4 w-4" /> Enregistrer un Gasto
                </Button>
            </div>

            <DataTable columns={columns} data={depenses || []} searchPlaceholder="Rechercher un gasto..." />

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <form onSubmit={handleSubmit}>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <ReceiptText className="h-5 w-5 text-destructive" />
                                Nouveau Gasto
                            </DialogTitle>
                            <DialogDescription>Rellene los detalles del gasto para descontar de tesorería.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="numero">Référence</Label>
                                    <Input id="numero" value={formData.numero} onChange={(e) => setFormData({...formData, numero: e.target.value})} required />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="date">Date</Label>
                                    <Input id="date" type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} required />
                                </div>
                            </div>
                            
                            <div className="grid gap-2">
                                <Label htmlFor="categorie">Catégorie de Gasto</Label>
                                <Select value={formData.categorie} onValueChange={(v) => setFormData({...formData, categorie: v})}>
                                    <SelectTrigger><SelectValue placeholder="Sélectionner une catégorie" /></SelectTrigger>
                                    <SelectContent>
                                        {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="tresorerie">Trésorerie / Caisse de Paiement</Label>
                                <Select value={formData.tresorerie_id} onValueChange={(v) => setFormData({...formData, tresorerie_id: v})}>
                                    <SelectTrigger><SelectValue placeholder="Sélectionner le compte de sortie" /></SelectTrigger>
                                    <SelectContent>
                                        {tresoreries?.map((t) => (
                                            <SelectItem key={t.id} value={t.id}>
                                                {t.libelle} (Solde: {Number(t.solde).toFixed(2)} DH)
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="montant">Montant (DH)</Label>
                                <Input id="montant" type="number" step="0.01" value={formData.montant} onChange={(e) => setFormData({...formData, montant: Number(e.target.value)})} required className="text-lg font-bold" />
                            </div>

                            <div className="flex items-center justify-between p-3 border rounded-lg bg-orange-500/5 border-orange-500/10">
                                <div className="space-y-0.5">
                                    <Label className="text-orange-600 font-bold">Gasto Facturé (Fiscal)</Label>
                                    <p className="text-xs text-muted-foreground mr-4">Si activé, impactará el Saldo Fiscal.</p>
                                </div>
                                <Switch checked={formData.inclure_tva} onCheckedChange={(v) => setFormData({...formData, inclure_tva: v})} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                            <Button type="submit" className="bg-destructive hover:bg-destructive/90">Valider le Gasto</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
