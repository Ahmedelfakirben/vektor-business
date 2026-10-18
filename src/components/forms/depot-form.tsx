"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { depotSchema, type DepotFormData } from "@/lib/validations/master-data"
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
import type { Depot } from "@/types/database"

interface DepotFormProps {
    defaultValues?: Depot
    onSubmit: (data: DepotFormData) => Promise<void>
    isLoading?: boolean
}

export function DepotForm({ defaultValues, onSubmit, isLoading }: DepotFormProps) {
    const form = useForm<DepotFormData>({
        resolver: zodResolver(depotSchema) as any,
        defaultValues: {
            code: defaultValues?.code || "",
            libelle: defaultValues?.libelle || "",
            adresse: defaultValues?.adresse || "",
            responsable_id: defaultValues?.responsable_id || "",
        },
    })

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Informations du dépôt</CardTitle>
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
                            name="libelle"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Libellé *</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Nom du dépôt" {...field} />
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
                                            <Textarea placeholder="Adresse du dépôt" {...field} value={field.value || ""} />
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
                        {defaultValues ? "Mettre à jour" : "Créer le dépôt"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => window.history.back()}>
                        Annuler
                    </Button>
                </div>
            </form>
        </Form>
    )
}
