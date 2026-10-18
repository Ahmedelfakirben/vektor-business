"use client"

import { useParams, useRouter } from "next/navigation"
import { useFournisseur, useUpdateFournisseur } from "@/hooks/use-fournisseurs"
import { FournisseurForm } from "@/components/forms/fournisseur-form"
import type { FournisseurFormData } from "@/lib/validations/master-data"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"

export default function ModifierFournisseurPage() {
    const params = useParams()
    const router = useRouter()
    const id = params.id as string
    const { data: fournisseur, isLoading } = useFournisseur(id)
    const updateFournisseur = useUpdateFournisseur()

    async function onSubmit(data: FournisseurFormData) {
        try {
            await updateFournisseur.mutateAsync({ id, data })
            toast.success("Fournisseur mis à jour avec succès")
            router.push("/fournisseurs")
        } catch {
            toast.error("Erreur lors de la mise à jour du fournisseur")
        }
    }

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-96 w-full" />
            </div>
        )
    }

    if (!fournisseur) return <p>Fournisseur introuvable</p>

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Modifier le fournisseur</h2>
                <p className="text-muted-foreground">{fournisseur.raison_sociale}</p>
            </div>
            <FournisseurForm
                defaultValues={fournisseur}
                onSubmit={onSubmit}
                isLoading={updateFournisseur.isPending}
            />
        </div>
    )
}
