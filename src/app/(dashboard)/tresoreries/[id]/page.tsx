"use client"
import { useParams } from "next/navigation"
import { useTresorerie, useMouvementsTresorerie } from "@/hooks/use-tresoreries-details"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LoadingScreen } from "@/components/ui/loading-screen"
import { Pencil, ArrowUpRight, ArrowDownLeft, ExternalLink } from "lucide-react"
import Link from "next/link"
import { DataTable } from "@/components/data-table/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { useMemo } from "react"

export default function TresorerieDetailPage() {
    const params = useParams()
    const id = params.id as string
    const { data: tresorerie, isLoading: loadingTresorerie } = useTresorerie(id)
    const { data: mouvementsRaw, isLoading: loadingMouvements } = useMouvementsTresorerie(id)

    // Calculate running balance
    const mouvements = useMemo(() => {
        if (!tresorerie || !mouvementsRaw) return []

        // Mouvements are ordered DESC (newest first)
        let currentSolde = Number(tresorerie.solde)

        return mouvementsRaw.map((m) => {
            const soldeApres = currentSolde

            // If movement was Entree, then Solde Before was Solde After - Amount
            // If movement was Sortie, then Solde Before was Solde After + Amount
            if (m.type === "entree") {
                currentSolde = currentSolde - Number(m.montant)
            } else {
                currentSolde = currentSolde + Number(m.montant)
            }

            return {
                ...m,
                solde_calcule: soldeApres
            }
        })
    }, [tresorerie, mouvementsRaw])

    if (loadingTresorerie || loadingMouvements) return <LoadingScreen />
    if (!tresorerie) return <p>Trésorerie introuvable</p>

    const columns: ColumnDef<any>[] = [
        {
            accessorKey: "created_at",
            header: "Date",
            cell: ({ row }) => new Date(row.original.created_at).toLocaleString("fr-FR"),
        },
        {
            accessorKey: "type",
            header: "Type",
            cell: ({ row }) => (
                <Badge variant={row.original.type === "entree" ? "default" : "destructive"}>
                    {row.original.type === "entree" ? <ArrowDownLeft className="mr-1 h-3 w-3" /> : <ArrowUpRight className="mr-1 h-3 w-3" />}
                    {row.original.type === "entree" ? "Recette" : "Dépense"}
                </Badge>
            ),
        },
        {
            accessorKey: "libelle",
            header: "Libellé",
            cell: ({ row }) => {
                const note = row.original.paiement_note
                const libelle = row.original.libelle
                return <span>{note || libelle}</span>
            }
        },
        {
            accessorKey: "montant",
            header: "Montant",
            cell: ({ row }) => (
                <span className={row.original.type === "entree" ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                    {row.original.type === "entree" ? "+" : "-"} {Number(row.original.montant).toFixed(2)} DH
                </span>
            ),
        },
        {
            accessorKey: "solde_calcule",
            header: "Solde",
            cell: ({ row }) => <span className="text-muted-foreground font-mono">{row.original.solde_calcule.toFixed(2)} DH</span>,
        },
        {
            id: "source",
            header: "Source",
            cell: ({ row }) => {
                const type = row.original.source_type
                const id = row.original.source_id
                let link = null
                let label = "Voir"

                if (type === "bon_livraison") {
                    link = `/bon-livraisons/${id}`
                    label = "Facture Client"
                } else if (type === "bon_achat") {
                    link = `/bon-achats/${id}`
                    label = "Facture Fournisseur"
                } else if (type === "bon_retour") {
                    link = `/bon-retours/${id}`
                    label = "Avoir Client"
                } else if (type === "bon_retour_achat") {
                    link = `/bon-retour-achats/${id}`
                    label = "Avoir Fournisseur"
                } else if (type === "vente_pos") {
                    link = `/pos`
                    label = "Vente POS"
                } else if (type === "retour_pos") {
                    link = `/pos`
                    label = "Retour POS"
                }

                if (link) {
                    return (
                        <Button asChild variant="link" size="sm" className="h-auto p-0">
                            <Link href={link} className="flex items-center gap-1">
                                {label} <ExternalLink className="h-3 w-3" />
                            </Link>
                        </Button>
                    )
                }
                return <span className="text-muted-foreground text-xs">{type || "Autre"}</span>
            }
        }
    ]

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">{tresorerie.libelle}</h2>
                    <p className="text-muted-foreground">Code : {tresorerie.code}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant={tresorerie.type === "banque" ? "default" : "secondary"}>
                        {tresorerie.type === "banque" ? "Banque" : "Caisse"}
                    </Badge>
                    <Button asChild><Link href={`/tresoreries/${tresorerie.id}/modifier`}><Pencil className="mr-2 h-4 w-4" />Modifier</Link></Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Solde Actuel</CardTitle>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            className="h-4 w-4 text-muted-foreground"
                        >
                            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                        </svg>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{Number(tresorerie.solde).toFixed(2)} DH</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader><CardTitle>Historique des transactions</CardTitle></CardHeader>
                <CardContent>
                    <DataTable columns={columns} data={mouvements || []} searchPlaceholder="Rechercher une transaction..." />
                </CardContent>
            </Card>
        </div>
    )
}
