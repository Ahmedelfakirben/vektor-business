"use client"

import { useParams, useRouter } from "next/navigation"
import { useVentePos } from "@/hooks/use-ventes-pos"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table"
import { ArrowLeft, Printer } from "lucide-react"
import Link from "next/link"

const modeLabels: Record<string, string> = {
  especes: "Espèces",
  carte: "Carte Bancaire",
  cheque: "Chèque",
  virement: "Virement",
}

export default function VentePosDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const { data: vente, isLoading } = useVentePos(id)

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-5xl mx-auto w-full">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!vente) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Vente introuvable</p>
        <Button className="mt-4" onClick={() => router.push("/pos?tab=historique")}>
          Retour à l&apos;historique
        </Button>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto p-6 max-w-5xl mx-auto w-full space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" asChild>
            <Link href="/pos?tab=historique">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Ticket N° {vente.numero}</h2>
            <p className="text-sm text-muted-foreground">
              {new Date(vente.date).toLocaleDateString("fr-FR")} {vente.created_at && `à ${new Date(vente.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" />
            Imprimer
          </Button>
          <Button asChild>
            <Link href="/pos">Nouveau Ticket (POS)</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Client</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold text-base">{vente.client?.raison_sociale || "Comptoir"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Mode de Règlement</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className="font-medium">
              {modeLabels[vente.mode_paiement] || vente.mode_paiement}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Trésorerie / Caisse</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{vente.tresorerie?.libelle || "Caisse Principale"}</p>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Total Encaissé</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-black text-primary">{Number(vente.montant_ttc).toFixed(2)} MAD</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Détail des Articles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Désignation</TableHead>
                  <TableHead className="w-[100px] text-center">Qté</TableHead>
                  <TableHead className="w-[130px] text-right">Prix unit.</TableHead>
                  <TableHead className="w-[90px] text-center">TVA</TableHead>
                  <TableHead className="w-[130px] text-right">Total HT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vente.lignes?.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.designation}</TableCell>
                    <TableCell className="text-center font-bold">{l.quantite}</TableCell>
                    <TableCell className="text-right">{Number(l.prix_unitaire).toFixed(2)} MAD</TableCell>
                    <TableCell className="text-center">{l.tva}%</TableCell>
                    <TableCell className="text-right font-semibold">{Number(l.montant_ht).toFixed(2)} MAD</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter className="bg-muted/30">
                <TableRow>
                  <TableCell colSpan={4} className="text-right">Total HT</TableCell>
                  <TableCell className="text-right font-medium">{Number(vente.montant_ht).toFixed(2)} MAD</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={4} className="text-right text-base font-bold">Total TTC</TableCell>
                  <TableCell className="text-right font-black text-base text-primary">
                    {Number(vente.montant_ttc).toFixed(2)} MAD
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
