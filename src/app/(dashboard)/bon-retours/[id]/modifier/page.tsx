"use client"
import { useParams, useRouter } from "next/navigation"
import { useBonRetour, useUpdateBonRetour } from "@/hooks/use-bon-retours"
import { BonRetourForm } from "@/components/documents/bon-retour-form"
import type { BonRetourFormData } from "@/lib/validations/documents"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"

export default function ModifierBonRetourPage() {
    const params = useParams()
    const router = useRouter()
    const id = params.id as string
    const { data: br, isLoading } = useBonRetour(id)
    const updateBR = useUpdateBonRetour()

    async function onSubmit(data: BonRetourFormData) {
        try { await updateBR.mutateAsync({ id, data }); toast.success("Bon de retour mis à jour"); router.push(`/bon-retours/${id}`) } catch { toast.error("Erreur lors de la mise à jour") }
    }

    if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96 w-full" /></div>
    if (!br) return <p>Bon de retour introuvable</p>

    return (
        <div className="space-y-6">
            <div><h2 className="text-3xl font-bold tracking-tight">Modifier le BR</h2><p className="text-muted-foreground">{br.numero}</p></div>
            <BonRetourForm defaultValues={br} onSubmit={onSubmit} isLoading={updateBR.isPending} />
        </div>
    )
}
