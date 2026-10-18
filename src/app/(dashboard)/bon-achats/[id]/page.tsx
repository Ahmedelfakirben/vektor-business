"use client"
import { useParams } from "next/navigation"
import { useBonAchat } from "@/hooks/use-bon-achats"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Pencil } from "lucide-react"
import Link from "next/link"
import { PrintDocumentButton } from "@/components/documents/print-document-button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table"
import { PaymentSection } from "@/components/finance/payment-section"

const statutColors: Record<string, "default" | "secondary" | "destructive"> = { brouillon: "secondary", valide: "default", annule: "destructive" }
const statutLabels: Record<string, string> = { brouillon: "Brouillon", valide: "Validé (Comptabilisé)", annule: "Annulé" }

import { CheckCircle } from "lucide-react"
import { useUpdateBonAchatStatut } from "@/hooks/use-bon-achats"
import { toast } from "sonner"

export default function BonAchatDetailPage() {
    const params = useParams()
    const id = params.id as string
    const { data: ba, isLoading } = useBonAchat(id)
    const updateStatut = useUpdateBonAchatStatut()

    const handleValidate = async () => {
        try {
            await updateStatut.mutateAsync({ id, statut: "valide" })
            toast.success("Bon d'achat validé. Les écritures comptables ont été générées.")
            toast.info("Vous pouvez maintenant enregistrer le paiement ci-dessous.")
        } catch (error) {
            toast.error("Erreur lors de la validation")
            console.error(error)
        }
    }
    if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>
    if (!ba) return <p>Bon d&apos;achat introuvable</p>
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div><h2 className="text-3xl font-bold tracking-tight">BA {ba.numero}</h2><p className="text-muted-foreground">Créé le {new Date(ba.created_at).toLocaleDateString("fr-FR")}</p></div>
                <div className="flex items-center gap-2">
                    <Badge variant={statutColors[ba.statut] || "secondary"}>{statutLabels[ba.statut] || ba.statut}</Badge>

                    {ba.statut === 'brouillon' && (
                        <Button onClick={handleValidate} disabled={updateStatut.isPending}>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Valider (Compta)
                        </Button>
                    )}

                    <PrintDocumentButton type="bon_achat" document={ba} />

                    {ba.statut === 'brouillon' && (
                        <Button asChild variant="outline">
                            <Link href={`/bon-achats/${ba.id}/modifier`}><Pencil className="mr-2 h-4 w-4" />Modifier</Link>
                        </Button>
                    )}
                </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
                <Card><CardHeader><CardTitle>Fournisseur</CardTitle></CardHeader><CardContent className="space-y-2"><p className="font-semibold">{ba.fournisseur?.raison_sociale}</p><p className="text-sm text-muted-foreground">{ba.fournisseur?.code}</p></CardContent></Card>
                <Card><CardHeader><CardTitle>Détails</CardTitle></CardHeader><CardContent className="space-y-2"><div><span className="text-sm text-muted-foreground">Date</span><p>{new Date(ba.date).toLocaleDateString("fr-FR")}</p></div><div><span className="text-sm text-muted-foreground">Dépôt</span><p>{(ba as any).depot?.libelle || "—"}</p></div></CardContent></Card>
                <Card><CardHeader><CardTitle>Montants</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                        <div><span className="text-sm text-muted-foreground">Total Net</span><p className="text-lg font-bold">{Number(ba.montant_ttc).toFixed(2)} MAD</p></div>
                    </CardContent>
                </Card>
            </div>
            <Card><CardHeader><CardTitle>Lignes</CardTitle></CardHeader><CardContent><div className="rounded-md border"><Table><TableHeader><TableRow><TableHead>Désignation</TableHead><TableHead className="w-[100px]">Qté</TableHead><TableHead className="w-[120px]">Prix unit.</TableHead><TableHead className="w-[120px] text-right">Montant Total</TableHead></TableRow></TableHeader><TableBody>{ba.lignes?.map((l) => (<TableRow key={l.id}><TableCell>{l.designation}</TableCell><TableCell>{l.quantite}</TableCell><TableCell>{Number(l.prix_unitaire).toFixed(2)} MAD</TableCell><TableCell className="text-right font-medium">{Number(l.montant_ht).toFixed(2)} MAD</TableCell></TableRow>))}</TableBody><TableFooter><TableRow><TableCell colSpan={3} className="text-right text-lg font-medium">Total Net</TableCell><TableCell className="text-right font-bold text-lg">{Number(ba.montant_ttc).toFixed(2)} MAD</TableCell></TableRow></TableFooter></Table></div></CardContent></Card>
            {ba.notes && <Card><CardHeader><CardTitle>Notes</CardTitle></CardHeader><CardContent><p>{ba.notes}</p></CardContent></Card>}

            <PaymentSection
                referenceType="bon_achat"
                referenceId={ba.id}
                montantTTC={ba.montant_ttc}
                montantRegle={ba.montant_regle || 0}
                statutPaiement={ba.statut_paiement || "impaye"}
            />
        </div>
    )
}
