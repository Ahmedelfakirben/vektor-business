"use client"

import { useRouter } from "next/navigation"
import { useCreateClient } from "@/hooks/use-clients"
import { ClientForm } from "@/components/forms/client-form"
import type { ClientFormData } from "@/lib/validations/master-data"
import { toast } from "sonner"

export default function NouveauClientPage() {
  const router = useRouter()
  const createClient = useCreateClient()

  async function onSubmit(data: ClientFormData) {
    try {
      await createClient.mutateAsync(data)
      toast.success("Client créé avec succès")
      router.push("/clients")
    } catch {
      toast.error("Erreur lors de la création du client")
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Nouveau client</h2>
        <p className="text-muted-foreground">Créer un nouveau client</p>
      </div>
      <ClientForm onSubmit={onSubmit} isLoading={createClient.isPending} />
    </div>
  )
}
