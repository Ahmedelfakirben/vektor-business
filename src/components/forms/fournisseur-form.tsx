"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { fournisseurSchema, type FournisseurFormData } from "@/lib/validations/master-data"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import type { Fournisseur } from "@/types/database"

interface FournisseurFormProps {
  defaultValues?: Fournisseur
  onSubmit: (data: FournisseurFormData) => Promise<void>
  isLoading?: boolean
}

export function FournisseurForm({ defaultValues, onSubmit, isLoading }: FournisseurFormProps) {
  const form = useForm<FournisseurFormData>({
    resolver: zodResolver(fournisseurSchema) as any,
    defaultValues: {
      code: defaultValues?.code || "",
      raison_sociale: defaultValues?.raison_sociale || "",
      adresse: defaultValues?.adresse || "",
      ville: defaultValues?.ville || "",
      telephone: defaultValues?.telephone || "",
      email: defaultValues?.email || "",
      ice: defaultValues?.ice || "",
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Informations générales</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {defaultValues && (
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code *</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} readOnly className="bg-muted" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="raison_sociale"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Raison sociale *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nom de l'entreprise" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ICE</FormLabel>
                  <FormControl>
                    <Input placeholder="ICE" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="contact@entreprise.com" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="telephone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Téléphone</FormLabel>
                  <FormControl>
                    <Input placeholder="+212 6XX XXX XXX" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ville"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ville</FormLabel>
                  <FormControl>
                    <Input placeholder="Casablanca" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="md:col-span-2">
              <FormField
                control={form.control}
                name="adresse"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adresse</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Adresse complète" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {defaultValues ? "Mettre à jour" : "Créer le fournisseur"}
          </Button>
          <Button type="button" variant="outline" onClick={() => window.history.back()}>
            Annuler
          </Button>
        </div>
      </form>
    </Form>
  )
}
