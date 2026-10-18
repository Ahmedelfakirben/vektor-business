"use client"
import { useRouter } from "next/navigation"
import { useCreateDepot } from "@/hooks/use-depots"
import { DepotForm } from "@/components/forms/depot-form"
import type { DepotFormData } from "@/lib/validations/master-data"
import { toast } from "sonner"

export default function NouveauDepotPage() {
    const router = useRouter()
    const createDepot = useCreateDepot()

    async function onSubmit(data: DepotFormData) {
        try {
            await createDepot.mutateAsync(data)
            toast.success("Dépôt créé avec succès")
            router.push("/depots")
        } catch {
            toast.error("Erreur lors de la création du dépôt")
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Nouveau dépôt</h2>
                <p className="text-muted-foreground">Créer un nouveau dépôt de stockage</p>
            </div>
            <DepotForm onSubmit={onSubmit} isLoading={createDepot.isPending} />
        </div>
    )
}
