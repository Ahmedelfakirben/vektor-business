"use client"
import { useParams, useRouter } from "next/navigation"
import { useBonCommande, useUpdateBonCommande } from "@/hooks/use-bon-commandes"
import { BonCommandeForm } from "@/components/documents/bon-commande-form"
import type { BonCommandeFormData } from "@/lib/validations/documents"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"

export default function ModifierBonCommandePage() {
    const params = useParams()
    const router = useRouter()
    const id = params.id as string
    const { data: bc, isLoading } = useBonCommande(id)
    const updateBC = useUpdateBonCommande()
    async function onSubmit(data: BonCommandeFormData) { try { await updateBC.mutateAsync({ id, data }); toast.success("Bon de commande mis à jour"); router.push(`/bon-commandes/${id}`) } catch { toast.error("Erreur lors de la mise à jour") } }
    if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96 w-full" /></div>
    if (!bc) return <p>Bon de commande introuvable</p>
    return (
        <div className="space-y-6">
            <div><h2 className="text-3xl font-bold tracking-tight">Modifier le BC</h2><p className="text-muted-foreground">{bc.numero}</p></div>
            <BonCommandeForm defaultValues={bc} onSubmit={onSubmit} isLoading={updateBC.isPending} />
        </div>
    )
}
