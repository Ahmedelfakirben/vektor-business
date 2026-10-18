"use client"
import { useParams } from "next/navigation"
import { useFamille } from "@/hooks/use-familles"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Pencil } from "lucide-react"
import Link from "next/link"

export default function FamilleDetailPage() {
    const params = useParams()
    const id = params.id as string
    const { data: famille, isLoading } = useFamille(id)

    if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>
    if (!famille) return <p>Famille introuvable</p>

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">{famille.libelle}</h2>
                    <p className="text-muted-foreground">Code : {famille.code}</p>
                </div>
                <Button asChild>
                    <Link href={`/familles/${famille.id}/modifier`}><Pencil className="mr-2 h-4 w-4" />Modifier</Link>
                </Button>
            </div>
            <Card>
                <CardHeader><CardTitle>Informations</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                    <div><span className="text-sm text-muted-foreground">Description</span><p>{famille.description || "—"}</p></div>
                    <div><span className="text-sm text-muted-foreground">Date de création</span><p>{new Date(famille.created_at).toLocaleDateString("fr-FR")}</p></div>
                </CardContent>
            </Card>
        </div>
    )
}
