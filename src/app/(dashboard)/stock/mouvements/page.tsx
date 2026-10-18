"use client"

import { useMouvementStockList } from "@/hooks/use-mouvements-stock"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { LoadingScreen } from "@/components/ui/loading-screen"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react"

export default function MouvementsStockPage() {
    const { data: mouvements, isLoading } = useMouvementStockList()

    if (isLoading) return <LoadingScreen />

    return (
        <div className="space-y-6">
            <div><h2 className="text-3xl font-bold tracking-tight">Mouvements de stock</h2><p className="text-muted-foreground">Historique des entrées et sorties de stock</p></div>
            <Card>
                <CardContent className="p-0">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Article</TableHead>
                                    <TableHead>Dépôt</TableHead><TableHead className="text-right">Quantité</TableHead>
                                    <TableHead>Référence</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {mouvements?.map((m) => (
                                    <TableRow key={m.id}>
                                        <TableCell>{new Date(m.created_at).toLocaleDateString("fr-FR")}</TableCell>
                                        <TableCell>
                                            {m.type === "entree" ? (
                                                <Badge variant="default" className="gap-1"><ArrowDownCircle className="h-3 w-3" />Entrée</Badge>
                                            ) : (
                                                <Badge variant="destructive" className="gap-1"><ArrowUpCircle className="h-3 w-3" />Sortie</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="font-medium">{m.article?.designation || "—"}</TableCell>
                                        <TableCell>{m.depot?.libelle || "—"}</TableCell>
                                        <TableCell className="text-right font-bold">{m.quantite}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{m.reference_type} {m.reference_id ? `#${m.reference_id.slice(0, 8)}` : ""}</TableCell>
                                    </TableRow>
                                ))}
                                {(!mouvements || mouvements.length === 0) && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucun mouvement</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
