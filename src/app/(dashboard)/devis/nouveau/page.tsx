"use client"

import { useRouter } from "next/navigation"
import { useCreateDevis } from "@/hooks/use-devis"
import { DevisForm } from "@/components/documents/devis-form"
import type { DevisFormData } from "@/lib/validations/documents"
import { toast } from "sonner"

export default function NouveauDevisPage() {
    const router = useRouter()
    const createDevis = useCreateDevis()

    async function onSubmit(data: DevisFormData) {
        try {
            await createDevis.mutateAsync(data)
            toast.success("Devis créé avec succès")
            router.push("/devis")
        } catch {
            toast.error("Erreur lors de la création du devis")
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Nouveau devis</h2>
                <p className="text-muted-foreground">Créer un nouveau devis client</p>
            </div>
            <DevisForm onSubmit={onSubmit} isLoading={createDevis.isPending} />
        </div>
    )
}
