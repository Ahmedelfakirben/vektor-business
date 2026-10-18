"use client"

import { useParams } from "next/navigation"
import { useBonRetour } from "@/hooks/use-bon-retours"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Pencil } from "lucide-react"
import Link from "next/link"
import { PrintDocumentButton } from "@/components/documents/print-document-button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table"

const statutColors: Record<string, "default" | "secondary" | "destructive"> = { brouillon: "secondary", valide: "default", annule: "destructive" }
const statutLabels: Record<string, string> = { brouillon: "Brouillon", valide: "Validé", annule: "Annulé" }

export default function BonRetourDetailPage() {
    const params = useParams()
    const id = params.id as string
    const { data: br, isLoading } = useBonRetour(id)

    if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>
    if (!br) return <p>Bon de retour introuvable</p>

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div><h2 className="text-3xl font-bold tracking-tight">BR {br.numero}</h2><p className="text-muted-foreground">Créé le {new Date(br.created_at).toLocaleDateString("fr-FR")}</p></div>
                <div className="flex items-center gap-2">
                    <Badge variant={statutColors[br.statut] || "secondary"}>{statutLabels[br.statut] || br.statut}</Badge>
                    <PrintDocumentButton type="bon_retour" document={br} />
                    <Button asChild><Link href={`/bon-retours/${br.id}/modifier`}><Pencil className="mr-2 h-4 w-4" />Modifier</Link></Button>
                </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader><CardTitle>Client</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                        <p className="font-semibold">{br.client?.raison_sociale}</p>
                        <p className="text-sm text-muted-foreground">{br.client?.code}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Détails</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                        <div><span className="text-sm text-muted-foreground">Date</span><p>{new Date(br.date).toLocaleDateString("fr-FR")}</p></div>
                        <div><span className="text-sm text-muted-foreground">Dépôt</span><p>{(br as any).depot?.libelle || "—"}</p></div>
                        {br.motif && <div><span className="text-sm text-muted-foreground">Motif</span><p>{br.motif}</p></div>}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Montants</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                        <div><span className="text-sm text-muted-foreground">Total Net</span><p className="text-lg font-bold">{Number(br.montant_ttc).toFixed(2)} MAD</p></div>
                    </CardContent>
                </Card>
            </div>
            <Card>
                <CardHeader><CardTitle>Lignes</CardTitle></CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                             <TableHeader><TableRow><TableHead>Désignation</TableHead><TableHead className="w-[100px]">Qté</TableHead><TableHead className="w-[120px]">Prix unit.</TableHead><TableHead className="w-[120px] text-right">Montant Total</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {br.lignes?.map((l) => (
                                    <TableRow key={l.id}><TableCell>{l.designation}</TableCell><TableCell>{l.quantite}</TableCell><TableCell>{Number(l.prix_unitaire).toFixed(2)} MAD</TableCell><TableCell className="text-right font-medium">{Number(l.montant_ht).toFixed(2)} MAD</TableCell></TableRow>
                                ))}
                            </TableBody>
                             <TableFooter>
                                 <TableRow><TableCell colSpan={3} className="text-right text-lg">Total Net</TableCell><TableCell className="text-right font-bold text-lg">{Number(br.montant_ttc).toFixed(2)} MAD</TableCell></TableRow>
                            </TableFooter>
                        </Table>
                    </div>
                </CardContent>
            </Card>
            {br.notes && <Card><CardHeader><CardTitle>Notes</CardTitle></CardHeader><CardContent><p>{br.notes}</p></CardContent></Card>}
        </div>
    )
}
