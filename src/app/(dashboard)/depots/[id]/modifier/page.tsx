"use client"
import { useParams, useRouter } from "next/navigation"
import { useDepot, useUpdateDepot } from "@/hooks/use-depots"
import { DepotForm } from "@/components/forms/depot-form"
import type { DepotFormData } from "@/lib/validations/master-data"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"

export default function ModifierDepotPage() {
    const params = useParams()
    const router = useRouter()
    const id = params.id as string
    const { data: depot, isLoading } = useDepot(id)
    const updateDepot = useUpdateDepot()

    async function onSubmit(data: DepotFormData) {
        try {
            await updateDepot.mutateAsync({ id, data })
            toast.success("Dépôt mis à jour avec succès")
            router.push("/depots")
        } catch {
            toast.error("Erreur lors de la mise à jour du dépôt")
        }
    }

    if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96 w-full" /></div>
    if (!depot) return <p>Dépôt introuvable</p>

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Modifier le dépôt</h2>
                <p className="text-muted-foreground">{depot.libelle}</p>
            </div>
            <DepotForm defaultValues={depot} onSubmit={onSubmit} isLoading={updateDepot.isPending} />
        </div>
    )
}
