"use client"
import { useRouter } from "next/navigation"
import { useCreateBonRetourAchat } from "@/hooks/use-bon-retour-achats"
import { BonRetourAchatForm } from "@/components/documents/bon-retour-achat-form"
import type { BonRetourAchatFormData } from "@/lib/validations/documents"
import { toast } from "sonner"

export default function NouveauBonRetourAchatPage() {
    const router = useRouter()
    const createBRA = useCreateBonRetourAchat()
    async function onSubmit(data: BonRetourAchatFormData) { try { await createBRA.mutateAsync(data); toast.success("Bon de retour achat créé"); router.push("/bon-retour-achats") } catch { toast.error("Erreur lors de la création") } }
    return (
        <div className="space-y-6">
            <div><h2 className="text-3xl font-bold tracking-tight">Nouveau bon de retour achat</h2><p className="text-muted-foreground">Retourner de la marchandise au fournisseur</p></div>
            <BonRetourAchatForm onSubmit={onSubmit} isLoading={createBRA.isPending} />
        </div>
    )
}
