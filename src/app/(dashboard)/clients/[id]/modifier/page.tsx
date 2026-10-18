"use client"

import { useParams, useRouter } from "next/navigation"
import { useClient, useUpdateClient } from "@/hooks/use-clients"
import { ClientForm } from "@/components/forms/client-form"
import type { ClientFormData } from "@/lib/validations/master-data"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"

export default function ModifierClientPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const { data: client, isLoading } = useClient(id)
  const updateClient = useUpdateClient()

  async function onSubmit(data: ClientFormData) {
    try {
      await updateClient.mutateAsync({ id, data })
      toast.success("Client mis à jour avec succès")
      router.push("/clients")
    } catch {
      toast.error("Erreur lors de la mise à jour du client")
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

  if (!client) return <p>Client introuvable</p>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Modifier le client</h2>
        <p className="text-muted-foreground">{client.raison_sociale}</p>
      </div>
      <ClientForm
        defaultValues={client}
        onSubmit={onSubmit}
        isLoading={updateClient.isPending}
      />
    </div>
  )
}
