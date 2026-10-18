"use client"
import { useParams, useRouter } from "next/navigation"
import { useTresorerie, useUpdateTresorerie } from "@/hooks/use-tresoreries"
import { TresorerieForm } from "@/components/forms/tresorerie-form"
import type { TresorerieFormData } from "@/lib/validations/master-data"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"

export default function ModifierTresoreriePage() {
    const params = useParams()
    const router = useRouter()
    const id = params.id as string
    const { data: tresorerie, isLoading } = useTresorerie(id)
    const updateTresorerie = useUpdateTresorerie()

    async function onSubmit(data: TresorerieFormData) {
        try {
            await updateTresorerie.mutateAsync({ id, data })
            toast.success("Trésorerie mise à jour avec succès")
            router.push("/tresoreries")
        } catch {
            toast.error("Erreur lors de la mise à jour de la trésorerie")
        }
    }

    if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96 w-full" /></div>
    if (!tresorerie) return <p>Trésorerie introuvable</p>

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Modifier la trésorerie</h2>
                <p className="text-muted-foreground">{tresorerie.libelle}</p>
            </div>
            <TresorerieForm defaultValues={tresorerie} onSubmit={onSubmit} isLoading={updateTresorerie.isPending} />
        </div>
    )
}
