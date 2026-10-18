"use client"
import { useRouter } from "next/navigation"
import { useCreateBonAchat } from "@/hooks/use-bon-achats"
import { BonAchatForm } from "@/components/documents/bon-achat-form"
import type { BonAchatFormData } from "@/lib/validations/documents"
import { toast } from "sonner"

export default function NouveauBonAchatPage() {
    const router = useRouter()
    const createBA = useCreateBonAchat()
    async function onSubmit(data: BonAchatFormData) { try { await createBA.mutateAsync(data); toast.success("Bon d'achat créé"); router.push("/bon-achats") } catch { toast.error("Erreur lors de la création") } }
    return (
        <div className="space-y-6">
            <div><h2 className="text-3xl font-bold tracking-tight">Nouveau bon d&apos;achat</h2><p className="text-muted-foreground">Enregistrer une réception fournisseur</p></div>
            <BonAchatForm onSubmit={onSubmit} isLoading={createBA.isPending} />
        </div>
    )
}
