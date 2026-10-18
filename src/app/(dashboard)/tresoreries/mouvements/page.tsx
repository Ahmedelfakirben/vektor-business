"use client"

import { useState } from "react"
import { useMouvementTresorerieList, useCreateMouvementTresorerie } from "@/hooks/use-mouvements-tresorerie"
import { useTresoreries } from "@/hooks/use-tresoreries"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { LoadingScreen } from "@/components/ui/loading-screen"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { ArrowDownCircle, ArrowUpCircle, Plus, Wallet } from "lucide-react"
import { toast } from "sonner"

export default function MouvementsTresoreriePage() {
    const { data: mouvements, isLoading } = useMouvementTresorerieList()
    const { data: tresoreries } = useTresoreries()
    const createMvt = useCreateMouvementTresorerie()
    const [open, setOpen] = useState(false)
    const [form, setForm] = useState({ tresorerie_id: "", type: "entree" as "entree" | "sortie", montant: "", libelle: "" })

    const handleSubmit = async () => {
        if (!form.tresorerie_id || !form.montant || !form.libelle) { toast.error("Remplir tous les champs"); return }
        try {
            await createMvt.mutateAsync({ tresorerie_id: form.tresorerie_id, type: form.type, montant: Number(form.montant), libelle: form.libelle, reference_type: null, reference_id: null })
            toast.success("Mouvement enregistré")
            setForm({ tresorerie_id: "", type: "entree", montant: "", libelle: "" })
            setOpen(false)
        } catch { toast.error("Erreur lors de l'enregistrement") }
    }

    const totalEntrees = mouvements?.filter((m) => m.type === "entree").reduce((s, m) => s + Number(m.montant), 0) || 0
    const totalSorties = mouvements?.filter((m) => m.type === "sortie").reduce((s, m) => s + Number(m.montant), 0) || 0

    if (isLoading) return <LoadingScreen />

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div><h2 className="text-3xl font-bold tracking-tight">Mouvements de trésorerie</h2><p className="text-muted-foreground">Entrées et sorties de fonds</p></div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Nouveau mouvement</Button></DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Nouveau mouvement de trésorerie</DialogTitle></DialogHeader>
                        <div className="space-y-4">
                            <div><Label>Trésorerie *</Label>
                                <Select value={form.tresorerie_id} onValueChange={(v) => setForm({ ...form, tresorerie_id: v })}>
                                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                                    <SelectContent>{tresoreries?.map((t) => (<SelectItem key={t.id} value={t.id}>{t.code} - {t.libelle}</SelectItem>))}</SelectContent>
                                </Select>
                            </div>
                            <div><Label>Type *</Label>
                                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as "entree" | "sortie" })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="entree">Entrée</SelectItem><SelectItem value="sortie">Sortie</SelectItem></SelectContent>
                                </Select>
                            </div>
                            <div><Label>Montant (MAD) *</Label><Input type="number" step="0.01" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} /></div>
                            <div><Label>Libellé *</Label><Input value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} /></div>
                            <Button onClick={handleSubmit} disabled={createMvt.isPending} className="w-full">{createMvt.isPending ? "Enregistrement..." : "Enregistrer"}</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total entrées</CardTitle><ArrowDownCircle className="h-4 w-4 text-green-500" /></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{totalEntrees.toFixed(2)} MAD</div></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total sorties</CardTitle><ArrowUpCircle className="h-4 w-4 text-destructive" /></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{totalSorties.toFixed(2)} MAD</div></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Solde net</CardTitle><Wallet className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{(totalEntrees - totalSorties).toFixed(2)} MAD</div></CardContent></Card>
            </div>

            <Card>
                <CardContent className="p-0">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Trésorerie</TableHead><TableHead>Libellé</TableHead><TableHead className="text-right">Montant</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {mouvements?.map((m) => (
                                    <TableRow key={m.id}>
                                        <TableCell>{new Date(m.created_at).toLocaleDateString("fr-FR")}</TableCell>
                                        <TableCell>{m.type === "entree" ? <Badge variant="default" className="gap-1"><ArrowDownCircle className="h-3 w-3" />Entrée</Badge> : <Badge variant="destructive" className="gap-1"><ArrowUpCircle className="h-3 w-3" />Sortie</Badge>}</TableCell>
                                        <TableCell>{m.tresorerie?.libelle || "—"}</TableCell>
                                        <TableCell className="font-medium">{m.libelle}</TableCell>
                                        <TableCell className={`text-right font-bold ${m.type === "entree" ? "text-green-600" : "text-destructive"}`}>{m.type === "entree" ? "+" : "-"}{Number(m.montant).toFixed(2)} MAD</TableCell>
                                    </TableRow>
                                ))}
                                {(!mouvements || mouvements.length === 0) && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucun mouvement</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
