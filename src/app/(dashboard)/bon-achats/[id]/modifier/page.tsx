"use client"
import { useParams, useRouter } from "next/navigation"
import { useBonAchat, useUpdateBonAchat } from "@/hooks/use-bon-achats"
import { BonAchatForm } from "@/components/documents/bon-achat-form"
import type { BonAchatFormData } from "@/lib/validations/documents"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"

export default function ModifierBonAchatPage() {
    const params = useParams()
    const router = useRouter()
    const id = params.id as string
    const { data: ba, isLoading } = useBonAchat(id)
    const updateBA = useUpdateBonAchat()
    async function onSubmit(data: BonAchatFormData) { try { await updateBA.mutateAsync({ id, data }); toast.success("Bon d'achat mis à jour"); router.push(`/bon-achats/${id}`) } catch { toast.error("Erreur lors de la mise à jour") } }
    if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96 w-full" /></div>
    if (!ba) return <p>Bon d&apos;achat introuvable</p>
    return (
        <div className="space-y-6">
            <div><h2 className="text-3xl font-bold tracking-tight">Modifier le BA</h2><p className="text-muted-foreground">{ba.numero}</p></div>
            <BonAchatForm defaultValues={ba} onSubmit={onSubmit} isLoading={updateBA.isPending} />
        </div>
    )
}
