"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { familleArticleSchema, type FamilleArticleFormData } from "@/lib/validations/master-data"
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
import type { FamilleArticle } from "@/types/database"

interface FamilleFormProps {
    defaultValues?: FamilleArticle
    onSubmit: (data: FamilleArticleFormData) => Promise<void>
    isLoading?: boolean
}

export function FamilleForm({ defaultValues, onSubmit, isLoading }: FamilleFormProps) {
    const form = useForm<FamilleArticleFormData>({
        resolver: zodResolver(familleArticleSchema) as any,
        defaultValues: {
            code: defaultValues?.code || "",
            libelle: defaultValues?.libelle || "",
            description: defaultValues?.description || "",
        },
    })

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Informations de la famille</CardTitle>
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
                                        <Input placeholder="Nom de la famille" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="md:col-span-2">
                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Description</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="Description de la famille d'articles" {...field} value={field.value || ""} />
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
                        {defaultValues ? "Mettre à jour" : "Créer la famille"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => window.history.back()}>
                        Annuler
                    </Button>
                </div>
            </form>
        </Form>
    )
}
