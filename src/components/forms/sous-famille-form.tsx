"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { sousFamilleArticleSchema, type SousFamilleArticleFormData } from "@/lib/validations/master-data"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { useFamilles } from "@/hooks/use-familles"
import type { SousFamilleArticle } from "@/types/database"

interface SousFamilleFormProps {
    defaultValues?: SousFamilleArticle
    onSubmit: (data: SousFamilleArticleFormData) => Promise<void>
    isLoading?: boolean
}

export function SousFamilleForm({ defaultValues, onSubmit, isLoading }: SousFamilleFormProps) {
    const { data: familles } = useFamilles()

    const form = useForm<SousFamilleArticleFormData>({
        resolver: zodResolver(sousFamilleArticleSchema),
        defaultValues: {
            famille_id: defaultValues?.famille_id || "",
            libelle: defaultValues?.libelle || "",
            description: defaultValues?.description || "",
            type_code_requis: defaultValues?.type_code_requis || "",
        },
    })

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                    <CardHeader><CardTitle>Informations de la sous-famille</CardTitle></CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                        <FormField control={form.control} name="famille_id" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Famille parente *</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner une famille" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {familles?.map((f) => (
                                            <SelectItem key={f.id} value={f.id}>{f.code} - {f.libelle}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="libelle" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Libellé *</FormLabel>
                                <FormControl><Input placeholder="Nom de la sous-famille" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="type_code_requis" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Type de code requis (Ex: IMEI, S/N, etc.)</FormLabel>
                                <FormControl><Input placeholder="Laisser vide si aucun code n'est requis" {...field} value={field.value || ""} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem className="md:col-span-2">
                                <FormLabel>Description</FormLabel>
                                <FormControl><Textarea placeholder="Description optionnelle..." {...field} value={field.value || ""} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </CardContent>
                </Card>

                <div className="flex gap-4">
                    <Button type="submit" disabled={isLoading} className="bg-orange-600 hover:bg-orange-700">
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {defaultValues ? "Mettre à jour" : "Créer la sous-famille"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => window.history.back()}>Annuler</Button>
                </div>
            </form>
        </Form>
    )
}
