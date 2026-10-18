"use client"
import { useParams } from "next/navigation"
import { useBonCommande } from "@/hooks/use-bon-commandes"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Pencil } from "lucide-react"
import Link from "next/link"
import { PrintDocumentButton } from "@/components/documents/print-document-button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table"

const statutColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = { brouillon: "secondary", valide: "default", envoye: "outline", recu: "default", annule: "destructive" }
const statutLabels: Record<string, string> = { brouillon: "Brouillon", valide: "Validé (BA Créé)", envoye: "Envoyé", recu: "Reçu", annule: "Annulé" }

import { CheckCircle, ArrowUpRight } from "lucide-react"
import { useUpdateBonCommandeStatut } from "@/hooks/use-bon-commandes"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export default function BonCommandeDetailPage() {
    const params = useParams()
    const router = useRouter()
    const id = params.id as string
    const { data: bc, isLoading } = useBonCommande(id)
    const updateStatut = useUpdateBonCommandeStatut()

    const handleValidate = async () => {
        try {
            const result = await updateStatut.mutateAsync({ id, statut: "recu" })
            toast.success("Bon de commande validé avec succès")

            // If BA created, redirect
            if (result && result.ba_id) {
                toast.success("Bon d'achat créé automatiquement")
                router.push(`/bon-achats/${result.ba_id}`)
            }
        } catch (error) {
            toast.error("Erreur lors de la validation")
            console.error(error)
        }
    }

    if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>
    if (!bc) return <p>Bon de commande introuvable</p>

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div><h2 className="text-3xl font-bold tracking-tight">BC {bc.numero}</h2><p className="text-muted-foreground">Créé le {new Date(bc.created_at).toLocaleDateString("fr-FR")}</p></div>
                <div className="flex items-center gap-2">
                    <Badge variant={statutColors[bc.statut] || "secondary"}>{statutLabels[bc.statut] || bc.statut}</Badge>

                    {/* If BA exists, show link */}
                    {(bc as any).bon_achats && (bc as any).bon_achats.length > 0 && (
                        <Button asChild variant="outline" className="border-primary text-primary hover:bg-primary/10">
                            <Link href={`/bon-achats/${(bc as any).bon_achats[0].id}`}>
                                <ArrowUpRight className="mr-2 h-4 w-4" />
                                Voir BA {(bc as any).bon_achats[0].numero}
                            </Link>
                        </Button>
                    )}

                    {/* If NO BA exists, allow validation even if checked as sent/received manually */}
                    {!(bc as any).bon_achats?.length && bc.statut !== 'annule' && (
                        <Button onClick={handleValidate} disabled={updateStatut.isPending}>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Valider & Créer BA
                        </Button>
                    )}

                    <PrintDocumentButton type="bon_commande" document={bc} />

                    {bc.statut === 'brouillon' && (
                        <Button asChild variant="outline">
                            <Link href={`/bon-commandes/${bc.id}/modifier`}><Pencil className="mr-2 h-4 w-4" />Modifier</Link>
                        </Button>
                    )}
                </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                <Card><CardHeader><CardTitle>Fournisseur</CardTitle></CardHeader><CardContent className="space-y-2"><p className="font-semibold">{bc.fournisseur?.raison_sociale}</p><p className="text-sm text-muted-foreground">{bc.fournisseur?.code}</p>{bc.fournisseur?.telephone && <p className="text-sm">{bc.fournisseur.telephone}</p>}</CardContent></Card>
                <Card><CardHeader><CardTitle>Montants</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                        <div><span className="text-sm text-muted-foreground">Total Net</span><p className="text-lg font-bold">{Number(bc.montant_ttc).toFixed(2)} MAD</p></div>
                    </CardContent>
                </Card>
            </div>
            <Card><CardHeader><CardTitle>Lignes</CardTitle></CardHeader><CardContent><div className="rounded-md border"><Table><TableHeader><TableRow><TableHead>Désignation</TableHead><TableHead className="w-[100px]">Qté</TableHead><TableHead className="w-[120px]">Prix unit.</TableHead><TableHead className="w-[120px] text-right">Montant Total</TableHead></TableRow></TableHeader><TableBody>{bc.lignes?.map((l) => (<TableRow key={l.id}><TableCell>{l.designation}</TableCell><TableCell>{l.quantite}</TableCell><TableCell>{Number(l.prix_unitaire).toFixed(2)} MAD</TableCell><TableCell className="text-right font-medium">{Number(l.montant_ht).toFixed(2)} MAD</TableCell></TableRow>))}</TableBody><TableFooter><TableRow><TableCell colSpan={3} className="text-right text-lg font-medium">Total Net</TableCell><TableCell className="text-right font-bold text-lg">{Number(bc.montant_ttc).toFixed(2)} MAD</TableCell></TableRow></TableFooter></Table></div></CardContent></Card>
            {bc.notes && <Card><CardHeader><CardTitle>Notes</CardTitle></CardHeader><CardContent><p>{bc.notes}</p></CardContent></Card>}
        </div>
    )
}
