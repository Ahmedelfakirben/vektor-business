"use client"

import { useRouter } from "next/navigation"
import { useCreateFournisseur } from "@/hooks/use-fournisseurs"
import { FournisseurForm } from "@/components/forms/fournisseur-form"
import type { FournisseurFormData } from "@/lib/validations/master-data"
import { toast } from "sonner"

export default function NouveauFournisseurPage() {
    const router = useRouter()
    const createFournisseur = useCreateFournisseur()

    async function onSubmit(data: FournisseurFormData) {
        try {
            await createFournisseur.mutateAsync(data)
            toast.success("Fournisseur créé avec succès")
            router.push("/fournisseurs")
        } catch {
            toast.error("Erreur lors de la création du fournisseur")
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Nouveau fournisseur</h2>
                <p className="text-muted-foreground">Créer un nouveau fournisseur</p>
            </div>
            <FournisseurForm onSubmit={onSubmit} isLoading={createFournisseur.isPending} />
        </div>
    )
}
