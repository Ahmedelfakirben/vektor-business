"use client"

import { usePaiements } from "@/hooks/use-paiements"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface PaymentHistoryProps {
    referenceType: string
    referenceId: string
    readOnly?: boolean
}

export function PaymentHistory({ referenceType, referenceId, readOnly = false }: PaymentHistoryProps) {
    const { data: paiements, isLoading, remove } = usePaiements(referenceType, referenceId)

    if (isLoading) return <p className="text-sm text-muted-foreground">Chargement des paiements...</p>

    if (!paiements || paiements.length === 0) {
        return <p className="text-sm text-muted-foreground italic">Aucun paiement enregistré.</p>
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Trésorerie</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                        {!readOnly && <TableHead className="w-[50px]"></TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {paiements.map((p) => (
                        <TableRow key={p.id}>
                            <TableCell>{new Date(p.date).toLocaleDateString("fr-FR")}</TableCell>
                            <TableCell className="capitalize">{p.mode_paiement}</TableCell>
                            <TableCell>{p.tresorerie?.libelle || "—"}</TableCell>
                            <TableCell className="text-right font-medium">
                                {Number(p.montant).toFixed(2)} MAD
                            </TableCell>
                            {!readOnly && (
                                <TableCell>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Supprimer ce paiement ?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Cela annulera le mouvement en trésorerie et mettra à jour le reste à payer.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => remove.mutate(p.id)}>
                                                    Supprimer
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </TableCell>
                            )}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
