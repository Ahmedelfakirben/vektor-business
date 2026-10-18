"use client"
import { useRouter } from "next/navigation"
import { useCreateBonLivraison } from "@/hooks/use-bon-livraisons"
import { BonLivraisonForm } from "@/components/documents/bon-livraison-form"
import type { BonLivraisonFormData } from "@/lib/validations/documents"
import { toast } from "sonner"

export default function NouveauBonLivraisonPage() {
    const router = useRouter()
    const createBL = useCreateBonLivraison()

    async function onSubmit(data: BonLivraisonFormData) {
        try { await createBL.mutateAsync(data); toast.success("Bon de livraison créé"); router.push("/bon-livraisons") } catch { toast.error("Erreur lors de la création") }
    }

    return (
        <div className="space-y-6">
            <div><h2 className="text-3xl font-bold tracking-tight">Nouveau bon de livraison</h2><p className="text-muted-foreground">Créer un nouveau bon de livraison</p></div>
            <BonLivraisonForm onSubmit={onSubmit} isLoading={createBL.isPending} />
        </div>
    )
}
