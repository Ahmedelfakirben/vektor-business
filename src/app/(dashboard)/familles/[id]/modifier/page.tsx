"use client"
import { useParams, useRouter } from "next/navigation"
import { useFamille, useUpdateFamille } from "@/hooks/use-familles"
import { FamilleForm } from "@/components/forms/famille-form"
import type { FamilleArticleFormData } from "@/lib/validations/master-data"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"

export default function ModifierFamillePage() {
    const params = useParams()
    const router = useRouter()
    const id = params.id as string
    const { data: famille, isLoading } = useFamille(id)
    const updateFamille = useUpdateFamille()

    async function onSubmit(data: FamilleArticleFormData) {
        try {
            await updateFamille.mutateAsync({ id, data })
            toast.success("Famille mise à jour avec succès")
            router.push("/familles")
        } catch {
            toast.error("Erreur lors de la mise à jour de la famille")
        }
    }

    if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96 w-full" /></div>
    if (!famille) return <p>Famille introuvable</p>

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Modifier la famille</h2>
                <p className="text-muted-foreground">{famille.libelle}</p>
            </div>
            <FamilleForm defaultValues={famille} onSubmit={onSubmit} isLoading={updateFamille.isPending} />
        </div>
    )
}
