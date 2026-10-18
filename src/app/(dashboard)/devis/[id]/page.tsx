"use client"

import { useParams } from "next/navigation"
import { useDevis } from "@/hooks/use-devis"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Pencil } from "lucide-react"
import Link from "next/link"
import { PrintDocumentButton } from "@/components/documents/print-document-button"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from "@/components/ui/table"

const statutColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    brouillon: "secondary", envoye: "outline", accepte: "default", refuse: "destructive", expire: "destructive",
}
const statutLabels: Record<string, string> = {
    brouillon: "Brouillon", envoye: "Envoyé", accepte: "Accepté", refuse: "Refusé", expire: "Expiré",
}

export default function DevisDetailPage() {
    const params = useParams()
    const id = params.id as string
    const { data: devis, isLoading } = useDevis(id)

    if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>
    if (!devis) return <p>Devis introuvable</p>

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Devis {devis.numero}</h2>
                    <p className="text-muted-foreground">Créé le {new Date(devis.created_at).toLocaleDateString("fr-FR")}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant={statutColors[devis.statut] || "secondary"}>
                        {statutLabels[devis.statut] || devis.statut}
                    </Badge>
                    <PrintDocumentButton type="devis" document={devis} />
                    <Button asChild><Link href={`/devis/${devis.id}/modifier`}><Pencil className="mr-2 h-4 w-4" />Modifier</Link></Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader><CardTitle>Client</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                        <p className="font-semibold">{devis.client?.raison_sociale}</p>
                        <p className="text-sm text-muted-foreground">{devis.client?.code}</p>
                        {devis.client?.telephone && <p className="text-sm">{devis.client.telephone}</p>}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Détails</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                        <div><span className="text-sm text-muted-foreground">Date</span><p>{new Date(devis.date).toLocaleDateString("fr-FR")}</p></div>
                        <div><span className="text-sm text-muted-foreground">Validité</span><p>{devis.validite_jours} jours</p></div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Montants</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                        <div><span className="text-sm text-muted-foreground">Total Net</span><p className="text-lg font-bold">{Number(devis.montant_ttc).toFixed(2)} MAD</p></div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader><CardTitle>Lignes du devis</CardTitle></CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Désignation</TableHead>
                                    <TableHead className="w-[100px]">Qté</TableHead>
                                    <TableHead className="w-[120px]">Prix unit.</TableHead>
                                    <TableHead className="w-[120px] text-right">Montant Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {devis.lignes?.map((ligne) => (
                                        <TableRow key={ligne.id}>
                                            <TableCell>{ligne.designation}</TableCell>
                                            <TableCell>{ligne.quantite}</TableCell>
                                            <TableCell>{Number(ligne.prix_unitaire).toFixed(2)} MAD</TableCell>
                                            <TableCell className="text-right font-medium">{Number(ligne.montant_ht).toFixed(2)} MAD</TableCell>
                                        </TableRow>
                                ))}
                            </TableBody>
                             <TableFooter>
                                <TableRow>
                                    <TableCell colSpan={3} className="text-right font-medium text-lg">Total Net</TableCell>
                                    <TableCell className="text-right font-bold text-lg">{Number(devis.montant_ttc).toFixed(2)} MAD</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {devis.notes && (
                <Card>
                    <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
                    <CardContent><p>{devis.notes}</p></CardContent>
                </Card>
            )}
        </div>
    )
}
