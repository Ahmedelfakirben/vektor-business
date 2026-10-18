"use client"
import { useRouter } from "next/navigation"
import { useCreateBonCommande } from "@/hooks/use-bon-commandes"
import { BonCommandeForm } from "@/components/documents/bon-commande-form"
import type { BonCommandeFormData } from "@/lib/validations/documents"
import { toast } from "sonner"

export default function NouveauBonCommandePage() {
    const router = useRouter()
    const createBC = useCreateBonCommande()
    async function onSubmit(data: BonCommandeFormData) { try { await createBC.mutateAsync(data); toast.success("Bon de commande créé"); router.push("/bon-commandes") } catch { toast.error("Erreur lors de la création") } }
    return (
        <div className="space-y-6">
            <div><h2 className="text-3xl font-bold tracking-tight">Nouveau bon de commande</h2><p className="text-muted-foreground">Créer une commande fournisseur</p></div>
            <BonCommandeForm onSubmit={onSubmit} isLoading={createBC.isPending} />
        </div>
    )
}
