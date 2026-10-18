"use client"
import { useParams, useRouter } from "next/navigation"
import { useSalarie, useUpdateSalarie } from "@/hooks/use-salaries"
import { SalarieForm } from "@/components/forms/salarie-form"
import type { SalarieFormData } from "@/lib/validations/master-data"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"

export default function ModifierSalariePage() {
    const params = useParams()
    const router = useRouter()
    const id = params.id as string
    const { data: salarie, isLoading } = useSalarie(id)
    const updateSalarie = useUpdateSalarie()

    async function onSubmit(data: SalarieFormData) {
        try {
            await updateSalarie.mutateAsync({ id, data })
            toast.success("Salarié mis à jour avec succès")
            router.push("/salaries")
        } catch {
            toast.error("Erreur lors de la mise à jour du salarié")
        }
    }

    if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96 w-full" /></div>
    if (!salarie) return <p>Salarié introuvable</p>

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Modifier le salarié</h2>
                <p className="text-muted-foreground">{salarie.prenom} {salarie.nom}</p>
            </div>
            <SalarieForm defaultValues={salarie} onSubmit={onSubmit} isLoading={updateSalarie.isPending} />
        </div>
    )
}
