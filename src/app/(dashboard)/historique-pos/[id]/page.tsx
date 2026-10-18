"use client"

import { useParams, useRouter } from "next/navigation"
import { useVentePos } from "@/hooks/use-ventes-pos"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table"
import { ArrowLeft, Printer, ShoppingBag, ExternalLink } from "lucide-react"
import Link from "next/link"
import { printPosTicket } from "@/lib/pos-printer"

const modeLabels: Record<string, string> = {
  especes: "Espèces",
  carte: "Carte Bancaire",
  cheque: "Chèque",
  virement: "Virement",
}

export default function HistoriquePosDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const { data: vente, isLoading } = useVentePos(id)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!vente) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-muted-foreground">Vente POS introuvable</p>
        <Button onClick={() => router.push("/historique-pos")}>
          Retour à l&apos;historique
        </Button>
      </div>
    )
  }

  const handlePrint = () => {
    const cashierName =
      [vente.commercial?.prenom, vente.commercial?.nom].filter(Boolean).join(" ") ||
      vente.commercial?.email?.split("@")[0] ||
      "Caissier"

    printPosTicket({
      numero: vente.numero,
      date: vente.date,
      heure: vente.created_at
        ? new Date(vente.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
        : undefined,
      caissier: cashierName,
      client: vente.client?.raison_sociale || "Client Comptoir",
      modePaiement: modeLabels[vente.mode_paiement] || vente.mode_paiement || "Espèces",
      lignes: (vente.lignes || []).map((l: any) => ({
        designation: l.designation || "Article",
        quantite: Number(l.quantite) || 1,
        prix_unitaire: Number(l.prix_unitaire) || 0,
        montant_total: Number(l.montant_ht) || (Number(l.quantite) || 1) * (Number(l.prix_unitaire) || 0),
      })),
      totalTTC: Number(vente.montant_ttc) || 0,
      montantRecu: Number(vente.montant_recu) || undefined,
      monnaieRendue: Number(vente.monnaie_rendue) || undefined,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="rounded-xl" asChild>
            <Link href="/historique-pos">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Ticket POS {vente.numero}</h2>
            <p className="text-sm text-muted-foreground">
              {new Date(vente.date).toLocaleDateString("fr-FR")}
              {vente.created_at &&
                ` à ${new Date(vente.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrint} className="rounded-xl gap-2 font-medium text-xs">
            <Printer className="h-4 w-4" />
            Imprimer Ticket
          </Button>

          <Button asChild className="rounded-xl gap-2 font-bold text-xs bg-orange-600 hover:bg-orange-700 text-white">
            <Link href="/pos" target="_blank">
              <ShoppingBag className="h-4 w-4" />
              <span>Ouvrir POS</span>
              <ExternalLink className="h-3 w-3 opacity-70" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl p-4 bg-card border-border/70 shadow-xs">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Client</span>
          <p className="text-lg font-bold text-foreground mt-1">{vente.client?.raison_sociale || "Comptoir"}</p>
        </Card>

        <Card className="rounded-2xl p-4 bg-card border-border/70 shadow-xs">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Mode de Règlement</span>
          <div className="mt-1.5">
            <Badge variant="outline" className="font-semibold text-xs">
              {modeLabels[vente.mode_paiement] || vente.mode_paiement}
            </Badge>
          </div>
        </Card>

        <Card className="rounded-2xl p-4 bg-card border-border/70 shadow-xs">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Trésorerie / Caisse</span>
          <p className="text-base font-semibold text-foreground mt-1">{vente.tresorerie?.libelle || "Caisse Principale"}</p>
          <span className="text-xs text-muted-foreground mt-0.5 block">{vente.depot?.libelle || "Dépôt Principal"}</span>
        </Card>

        <Card className="rounded-2xl p-4 bg-primary/5 border-primary/20 shadow-xs">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Total Encaissé</span>
          <p className="text-2xl font-black text-primary mt-1">{Number(vente.montant_ttc).toFixed(2)} MAD</p>
        </Card>
      </div>

      <Card className="rounded-2xl border-border/70 shadow-xs overflow-hidden">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="text-base font-bold">Articles du Ticket</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="py-3 px-4">Désignation</TableHead>
                <TableHead className="py-3 px-4 w-[100px] text-center">Qté</TableHead>
                <TableHead className="py-3 px-4 w-[130px] text-right">Prix unit.</TableHead>
                <TableHead className="py-3 px-4 w-[130px] text-right">Montant Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border/60">
              {vente.lignes?.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="py-3 px-4 font-semibold text-foreground">{l.designation}</TableCell>
                  <TableCell className="py-3 px-4 text-center font-black">{l.quantite}</TableCell>
                  <TableCell className="py-3 px-4 text-right">{Number(l.prix_unitaire).toFixed(2)} MAD</TableCell>
                  <TableCell className="py-3 px-4 text-right font-bold">{Number(l.montant_ht).toFixed(2)} MAD</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="bg-muted/30 font-bold">
              <TableRow>
                <TableCell colSpan={3} className="text-right py-3 px-4 text-base font-black text-foreground">Total Encaissé</TableCell>
                <TableCell className="text-right py-3 px-4 text-lg font-black text-primary">
                  {Number(vente.montant_ttc).toFixed(2)} MAD
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
