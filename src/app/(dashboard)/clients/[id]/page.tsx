"use client"

import { useParams } from "next/navigation"
import { useClient } from "@/hooks/use-clients"
import { useDevisByClient } from "@/hooks/use-devis"
import { useBonLivraisonsByClient } from "@/hooks/use-bon-livraisons"
import { useBonRetoursByClient } from "@/hooks/use-bon-retours"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { LoadingScreen } from "@/components/ui/loading-screen"
import { Pencil, Eye } from "lucide-react"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataTable } from "@/components/data-table/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import type { Devis, BonLivraison, BonRetour } from "@/types/database"

export default function ClientDetailPage() {
  const params = useParams()
  const id = params.id as string
  const { data: client, isLoading } = useClient(id)

  const { data: devisList, isLoading: isLoadingDevis } = useDevisByClient(id)
  const { data: blList, isLoading: isLoadingBL } = useBonLivraisonsByClient(id)
  const { data: brList, isLoading: isLoadingBR } = useBonRetoursByClient(id)

  if (isLoading) return <LoadingScreen />

  if (!client) return <p>Client introuvable</p>

  // --- Devis Columns ---
  const devisCols: ColumnDef<Devis>[] = [
    { accessorKey: "numero", header: "N° Devis" },
    { accessorKey: "date", header: "Date", cell: ({ row }) => new Date(row.original.date).toLocaleDateString("fr-FR") },
    { accessorKey: "montant_ttc", header: "Montant TTC", cell: ({ row }) => `${Number(row.original.montant_ttc).toFixed(2)} MAD` },
    {
      accessorKey: "statut", header: "Statut",
      cell: ({ row }) => {
        const colors: any = { brouillon: "secondary", envoye: "outline", accepte: "default", refuse: "destructive", expire: "destructive" }
        const labels: any = { brouillon: "Brouillon", envoye: "Envoyé", accepte: "Accepté", refuse: "Refusé", expire: "Expiré" }
        return <Badge variant={colors[row.original.statut] || "secondary"}>{labels[row.original.statut] || row.original.statut}</Badge>
      }
    },
    {
      id: "actions",
      enableSorting: false,
      cell: ({ row }) => (
        <Button asChild variant="ghost" size="sm"><Link href={`/devis/${row.original.id}`}><Eye className="h-4 w-4 mr-2" />Voir</Link></Button>
      )
    }
  ]

  // --- BL Columns ---
  const blCols: ColumnDef<BonLivraison>[] = [
    { accessorKey: "numero", header: "N° BL" },
    { accessorKey: "date", header: "Date", cell: ({ row }) => new Date(row.original.date).toLocaleDateString("fr-FR") },
    { accessorKey: "montant_ttc", header: "Montant TTC", cell: ({ row }) => `${Number(row.original.montant_ttc).toFixed(2)} MAD` },
    {
      accessorKey: "statut", header: "Statut",
      cell: ({ row }) => {
        const colors: any = { brouillon: "secondary", validee: "default", livree: "default", annulee: "destructive" }
        const labels: any = { brouillon: "Brouillon", validee: "Validé", livree: "Livré", annulee: "Annulé" }
        return <Badge variant={colors[row.original.statut] || "secondary"}>{labels[row.original.statut] || row.original.statut}</Badge>
      }
    },
    {
      id: "actions",
      enableSorting: false,
      cell: ({ row }) => (
        <Button asChild variant="ghost" size="sm"><Link href={`/bon-livraisons/${row.original.id}`}><Eye className="h-4 w-4 mr-2" />Voir</Link></Button>
      )
    }
  ]

  // --- BR Columns ---
  const brCols: ColumnDef<BonRetour>[] = [
    { accessorKey: "numero", header: "N° BR" },
    { accessorKey: "date", header: "Date", cell: ({ row }) => new Date(row.original.date).toLocaleDateString("fr-FR") },
    { accessorKey: "montant_ttc", header: "Montant TTC", cell: ({ row }) => `${Number(row.original.montant_ttc).toFixed(2)} MAD` },
    {
      accessorKey: "statut", header: "Statut",
      cell: ({ row }) => {
        const colors: any = { brouillon: "secondary", valide: "default", annule: "destructive" }
        const labels: any = { brouillon: "Brouillon", valide: "Validé", annule: "Annulé" }
        return <Badge variant={colors[row.original.statut] || "secondary"}>{labels[row.original.statut] || row.original.statut}</Badge>
      }
    },
    {
      id: "actions",
      enableSorting: false,
      cell: ({ row }) => (
        <Button asChild variant="ghost" size="sm"><Link href={`/bon-retours/${row.original.id}`}><Eye className="h-4 w-4 mr-2" />Voir</Link></Button>
      )
    }
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{client.raison_sociale}</h2>
          <p className="text-muted-foreground">Code : {client.code}</p>
        </div>
        <Button asChild>
          <Link href={`/clients/${client.id}/modifier`}>
            <Pencil className="mr-2 h-4 w-4" />
            Modifier
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="infos" className="w-full">
        <TabsList>
          <TabsTrigger value="infos">Informations</TabsTrigger>
          <TabsTrigger value="devis">Devis ({devisList?.length || 0})</TabsTrigger>
          <TabsTrigger value="bl">Bons de Livraison ({blList?.length || 0})</TabsTrigger>
          <TabsTrigger value="br">Retours ({brList?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="infos" className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Coordonnées</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="text-sm text-muted-foreground">Adresse</span>
                  <p>{client.adresse || "—"}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Ville</span>
                  <p>{client.ville || "—"}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Téléphone</span>
                  <p>{client.telephone || "—"}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">E-mail</span>
                  <p>{client.email || "—"}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Informations légales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="text-sm text-muted-foreground">ICE</span>
                  <p>{client.ice || "—"}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Date de création</span>
                  <p>{new Date(client.created_at).toLocaleDateString("fr-FR")}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="devis">
          <div className="pt-4">
            {isLoadingDevis ? <Skeleton className="h-48 w-full" /> : (
              <DataTable columns={devisCols} data={devisList || []} searchPlaceholder="Filtrer..." />
            )}
          </div>
        </TabsContent>

        <TabsContent value="bl">
          <div className="pt-4">
            {isLoadingBL ? <Skeleton className="h-48 w-full" /> : (
              <DataTable columns={blCols} data={blList || []} searchPlaceholder="Filtrer..." />
            )}
          </div>
        </TabsContent>

        <TabsContent value="br">
          <div className="pt-4">
            {isLoadingBR ? <Skeleton className="h-48 w-full" /> : (
              <DataTable columns={brCols} data={brList || []} searchPlaceholder="Filtrer..." />
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
