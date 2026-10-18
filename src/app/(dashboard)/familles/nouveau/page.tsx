"use client"
import { useRouter } from "next/navigation"
import { useCreateFamille } from "@/hooks/use-familles"
import { FamilleForm } from "@/components/forms/famille-form"
import type { FamilleArticleFormData } from "@/lib/validations/master-data"
import { toast } from "sonner"

export default function NouvelleFamillePage() {
    const router = useRouter()
    const createFamille = useCreateFamille()

    async function onSubmit(data: FamilleArticleFormData) {
        try {
            await createFamille.mutateAsync(data)
            toast.success("Famille créée avec succès")
            router.push("/familles")
        } catch {
            toast.error("Erreur lors de la création de la famille")
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Nouvelle famille</h2>
                <p className="text-muted-foreground">Créer une nouvelle famille d&apos;articles</p>
            </div>
            <FamilleForm onSubmit={onSubmit} isLoading={createFamille.isPending} />
        </div>
    )
}
