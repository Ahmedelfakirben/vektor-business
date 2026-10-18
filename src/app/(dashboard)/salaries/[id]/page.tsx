"use client"
import { useParams } from "next/navigation"
import { useSalarie } from "@/hooks/use-salaries"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LoadingScreen } from "@/components/ui/loading-screen"
import { Pencil } from "lucide-react"
import Link from "next/link"

export default function SalarieDetailPage() {
    const params = useParams()
    const id = params.id as string
    const { data: salarie, isLoading } = useSalarie(id)

    if (isLoading) return <LoadingScreen />
    if (!salarie) return <p>Salarié introuvable</p>

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">{salarie.prenom} {salarie.nom}</h2>
                    <p className="text-muted-foreground">Matricule : {salarie.matricule}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant={salarie.actif ? "default" : "secondary"}>{salarie.actif ? "Actif" : "Inactif"}</Badge>
                    <Button asChild><Link href={`/salaries/${salarie.id}/modifier`}><Pencil className="mr-2 h-4 w-4" />Modifier</Link></Button>
                </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader><CardTitle>Informations personnelles</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                        <div><span className="text-sm text-muted-foreground">Poste</span><p>{salarie.poste || "—"}</p></div>
                        <div><span className="text-sm text-muted-foreground">Téléphone</span><p>{salarie.telephone || "—"}</p></div>
                        <div><span className="text-sm text-muted-foreground">E-mail</span><p>{salarie.email || "—"}</p></div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Contrat</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                        <div><span className="text-sm text-muted-foreground">Date d&apos;embauche</span><p>{salarie.date_embauche ? new Date(salarie.date_embauche).toLocaleDateString("fr-FR") : "—"}</p></div>
                        <div><span className="text-sm text-muted-foreground">Salaire</span><p>{salarie.salaire ? `${Number(salarie.salaire).toFixed(2)} DH` : "—"}</p></div>
                        <div><span className="text-sm text-muted-foreground">Date de création</span><p>{new Date(salarie.created_at).toLocaleDateString("fr-FR")}</p></div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
