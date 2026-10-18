"use client"

import { useParams, useRouter } from "next/navigation"
import { useDevis, useUpdateDevis } from "@/hooks/use-devis"
import { DevisForm } from "@/components/documents/devis-form"
import type { DevisFormData } from "@/lib/validations/documents"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"

export default function ModifierDevisPage() {
    const params = useParams()
    const router = useRouter()
    const id = params.id as string
    const { data: devis, isLoading } = useDevis(id)
    const updateDevis = useUpdateDevis()

    async function onSubmit(data: DevisFormData) {
        try {
            await updateDevis.mutateAsync({ id, data })
            toast.success("Devis mis à jour avec succès")
            router.push(`/devis/${id}`)
        } catch {
            toast.error("Erreur lors de la mise à jour du devis")
        }
    }

    if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96 w-full" /></div>
    if (!devis) return <p>Devis introuvable</p>

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Modifier le devis</h2>
                <p className="text-muted-foreground">{devis.numero}</p>
            </div>
            <DevisForm defaultValues={devis} onSubmit={onSubmit} isLoading={updateDevis.isPending} />
        </div>
    )
}
