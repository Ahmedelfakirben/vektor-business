"use client"
import { useRouter } from "next/navigation"
import { useCreateBonRetour } from "@/hooks/use-bon-retours"
import { BonRetourForm } from "@/components/documents/bon-retour-form"
import type { BonRetourFormData } from "@/lib/validations/documents"
import { toast } from "sonner"

export default function NouveauBonRetourPage() {
    const router = useRouter()
    const createBR = useCreateBonRetour()

    async function onSubmit(data: BonRetourFormData) {
        try { await createBR.mutateAsync(data); toast.success("Bon de retour créé"); router.push("/bon-retours") } catch { toast.error("Erreur lors de la création") }
    }

    return (
        <div className="space-y-6">
            <div><h2 className="text-3xl font-bold tracking-tight">Nouveau bon de retour</h2><p className="text-muted-foreground">Créer un nouveau bon de retour</p></div>
            <BonRetourForm onSubmit={onSubmit} isLoading={createBR.isPending} />
        </div>
    )
}
