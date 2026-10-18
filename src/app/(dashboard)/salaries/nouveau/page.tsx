"use client"
import { useRouter } from "next/navigation"
import { useCreateSalarie } from "@/hooks/use-salaries"
import { SalarieForm } from "@/components/forms/salarie-form"
import type { SalarieFormData } from "@/lib/validations/master-data"
import { toast } from "sonner"

export default function NouveauSalariePage() {
    const router = useRouter()
    const createSalarie = useCreateSalarie()

    async function onSubmit(data: SalarieFormData) {
        try {
            await createSalarie.mutateAsync(data)
            toast.success("Salarié créé avec succès")
            router.push("/salaries")
        } catch {
            toast.error("Erreur lors de la création du salarié")
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Nouveau salarié</h2>
                <p className="text-muted-foreground">Créer un nouveau salarié</p>
            </div>
            <SalarieForm onSubmit={onSubmit} isLoading={createSalarie.isPending} />
        </div>
    )
}
