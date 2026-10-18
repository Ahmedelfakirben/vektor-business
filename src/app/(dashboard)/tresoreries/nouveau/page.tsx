"use client"
import { useRouter } from "next/navigation"
import { useCreateTresorerie } from "@/hooks/use-tresoreries"
import { TresorerieForm } from "@/components/forms/tresorerie-form"
import type { TresorerieFormData } from "@/lib/validations/master-data"
import { toast } from "sonner"

export default function NouvelleTresoreriePage() {
    const router = useRouter()
    const createTresorerie = useCreateTresorerie()

    async function onSubmit(data: TresorerieFormData) {
        try {
            await createTresorerie.mutateAsync(data)
            toast.success("Trésorerie créée avec succès")
            router.push("/tresoreries")
        } catch {
            toast.error("Erreur lors de la création de la trésorerie")
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Nouvelle trésorerie</h2>
                <p className="text-muted-foreground">Créer une nouvelle caisse ou compte bancaire</p>
            </div>
            <TresorerieForm onSubmit={onSubmit} isLoading={createTresorerie.isPending} />
        </div>
    )
}
