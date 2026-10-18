"use client"
import { useParams, useRouter } from "next/navigation"
import { useBonRetourAchat, useUpdateBonRetourAchat } from "@/hooks/use-bon-retour-achats"
import { BonRetourAchatForm } from "@/components/documents/bon-retour-achat-form"
import type { BonRetourAchatFormData } from "@/lib/validations/documents"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"

export default function ModifierBonRetourAchatPage() {
    const params = useParams()
    const router = useRouter()
    const id = params.id as string
    const { data: bra, isLoading } = useBonRetourAchat(id)
    const updateBRA = useUpdateBonRetourAchat()
    async function onSubmit(data: BonRetourAchatFormData) { try { await updateBRA.mutateAsync({ id, data }); toast.success("Bon de retour achat mis à jour"); router.push(`/bon-retour-achats/${id}`) } catch { toast.error("Erreur lors de la mise à jour") } }
    if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96 w-full" /></div>
    if (!bra) return <p>Bon de retour achat introuvable</p>
    return (
        <div className="space-y-6">
            <div><h2 className="text-3xl font-bold tracking-tight">Modifier le BRA</h2><p className="text-muted-foreground">{bra.numero}</p></div>
            <BonRetourAchatForm defaultValues={bra} onSubmit={onSubmit} isLoading={updateBRA.isPending} />
        </div>
    )
}
