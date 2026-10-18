"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { bonCommandeSchema, type BonCommandeFormData } from "@/lib/validations/documents"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { DocumentLines } from "./document-lines"
import { useFournisseurs } from "@/hooks/use-fournisseurs"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { BonCommande, Article } from "@/types/database"

interface BonCommandeFormProps {
    defaultValues?: BonCommande
    onSubmit: (data: BonCommandeFormData) => Promise<void>
    isLoading?: boolean
}

export function BonCommandeForm({ defaultValues, onSubmit, isLoading }: BonCommandeFormProps) {
    const { data: fournisseurs } = useFournisseurs()
    const supabase = createClient()
    const { data: articles } = useQuery({
        queryKey: ["articles-active"],
        queryFn: async () => {
            const { data, error } = await supabase.from("articles").select("*").eq("actif", true).order("designation")
            if (error) throw error
            return data as Article[]
        },
    })

    const form = useForm<BonCommandeFormData>({
        resolver: zodResolver(bonCommandeSchema) as any,
        defaultValues: {
            date: defaultValues?.date || new Date().toISOString().split("T")[0],
            fournisseur_id: defaultValues?.fournisseur_id || "",
            notes: defaultValues?.notes || "",
            inclure_tva: defaultValues?.inclure_tva || false,
            lignes: defaultValues?.lignes?.map((l) => ({
                article_id: l.article_id, designation: l.designation, quantite: l.quantite,
                prix_unitaire: l.prix_unitaire, tva: l.tva, montant_ht: l.montant_ht, ordre: l.ordre,
            })) || [{ article_id: null, designation: "", quantite: 1, prix_unitaire: 0, tva: 20, montant_ht: 0, ordre: 0 }],
        },
    })

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                    <CardHeader><CardTitle>Informations du bon de commande</CardTitle></CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                        <FormField control={form.control} name="date" render={({ field }) => (
                            <FormItem><FormLabel>Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="fournisseur_id" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Fournisseur *</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner un fournisseur" /></SelectTrigger></FormControl>
                                    <SelectContent>{fournisseurs?.map((f) => (<SelectItem key={f.id} value={f.id}>{f.code} - {f.raison_sociale}</SelectItem>))}</SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Lignes</CardTitle></CardHeader>
                    <CardContent>
                        <DocumentLines
                            control={form.control}
                            watch={form.watch}
                            setValue={form.setValue}
                            articles={articles || []}
                            docType="bon_commande"
                        />
                        {form.formState.errors.lignes && <p className="text-sm text-destructive mt-2">{form.formState.errors.lignes.message || "Vérifiez les lignes"}</p>}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
                    <CardContent>
                        <FormField control={form.control} name="notes" render={({ field }) => (
                            <FormItem><FormControl><Textarea placeholder="Notes..." rows={3} {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                        )} />
                    </CardContent>
                </Card>

                <div className="flex gap-4">
                    <Button type="submit" disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{defaultValues ? "Mettre à jour" : "Créer le bon de commande"}</Button>
                    <Button type="button" variant="outline" onClick={() => window.history.back()}>Annuler</Button>
                </div>
            </form>
        </Form>
    )
}
