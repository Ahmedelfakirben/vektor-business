"use client"
import { useParams, useRouter } from "next/navigation"
import { useBonLivraison, useUpdateBonLivraison } from "@/hooks/use-bon-livraisons"
import { BonLivraisonForm } from "@/components/documents/bon-livraison-form"
import type { BonLivraisonFormData } from "@/lib/validations/documents"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"

export default function ModifierBonLivraisonPage() {
    const params = useParams()
    const router = useRouter()
    const id = params.id as string
    const { data: bl, isLoading } = useBonLivraison(id)
    const updateBL = useUpdateBonLivraison()

    async function onSubmit(data: BonLivraisonFormData) {
        try { await updateBL.mutateAsync({ id, data }); toast.success("Bon de livraison mis à jour"); router.push(`/bon-livraisons/${id}`) } catch { toast.error("Erreur lors de la mise à jour") }
    }

    if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96 w-full" /></div>
    if (!bl) return <p>Bon de livraison introuvable</p>

    return (
        <div className="space-y-6">
            <div><h2 className="text-3xl font-bold tracking-tight">Modifier le BL</h2><p className="text-muted-foreground">{bl.numero}</p></div>
            <BonLivraisonForm defaultValues={bl} onSubmit={onSubmit} isLoading={updateBL.isPending} />
        </div>
    )
}
