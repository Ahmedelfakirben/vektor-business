"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { bonAchatSchema, type BonAchatFormData } from "@/lib/validations/documents"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { DocumentLines } from "./document-lines"
import { PaymentFormManager } from "@/components/finance/payment-form-manager"
import { useFournisseurs } from "@/hooks/use-fournisseurs"
import { useDepots } from "@/hooks/use-depots"
import { useTresoreries } from "@/hooks/use-tresoreries"
import { useArticles } from "@/hooks/use-articles"
import type { BonAchat } from "@/types/database"

interface BonAchatFormProps {
    defaultValues?: BonAchat
    onSubmit: (data: BonAchatFormData) => Promise<void>
    isLoading?: boolean
}

export function BonAchatForm({ defaultValues, onSubmit, isLoading }: BonAchatFormProps) {
    const { data: fournisseurs } = useFournisseurs()
    const { data: depots } = useDepots()
    const { data: tresoreries } = useTresoreries()
    const { data: articles } = useArticles()

    const form = useForm<BonAchatFormData>({
        resolver: zodResolver(bonAchatSchema) as any,
        defaultValues: {
            date: defaultValues?.date || new Date().toISOString().split("T")[0],
            fournisseur_id: defaultValues?.fournisseur_id || "",
            bon_commande_id: defaultValues?.bon_commande_id || "",
            depot_id: defaultValues?.depot_id || "",
            notes: defaultValues?.notes || "",
            inclure_tva: defaultValues?.inclure_tva || false,
            lignes: defaultValues?.lignes?.map((l) => ({
                article_id: l.article_id, 
                designation: l.designation, 
                quantite: l.quantite,
                prix_unitaire: l.prix_unitaire, 
                tva: l.tva, 
                montant_ht: l.montant_ht, 
                codes_articles: (l as any).codes_articles || [],
                ordre: l.ordre,
            })) || [{ article_id: null, designation: "", quantite: 1, prix_unitaire: 0, tva: 20, montant_ht: 0, codes_articles: [], ordre: 0 }],
            paiements: [],
        },
    })

    const lignes = form.watch("lignes") || []
    const totalTTC = lignes.reduce((s, l) => s + (l.quantite || 0) * (l.prix_unitaire || 0), 0)

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                    <CardHeader><CardTitle>Informations du bon d&apos;achat</CardTitle></CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-3">
                        <FormField control={form.control} name="date" render={({ field }) => (
                            <FormItem><FormLabel>Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="fournisseur_id" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Fournisseur *</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner un fournisseur" /></SelectTrigger></FormControl>
                                    <SelectContent>{fournisseurs?.map((f) => (<SelectItem key={f.id} value={f.id}>{f.code} - {f.raison_sociale}</SelectItem>))}</SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="depot_id" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Dépôt *</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner un dépôt" /></SelectTrigger></FormControl>
                                    <SelectContent>{depots?.map((d) => (<SelectItem key={d.id} value={d.id}>{d.code} - {d.libelle}</SelectItem>))}</SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </CardContent>
                </Card>

                <PaymentFormManager 
                    control={form.control}
                    watch={form.watch}
                    setValue={form.setValue}
                    totalTTC={totalTTC}
                />

                <Card>
                    <CardHeader><CardTitle>Lignes</CardTitle></CardHeader>
                    <CardContent>
                        <DocumentLines
                            control={form.control}
                            watch={form.watch}
                            setValue={form.setValue}
                            articles={articles || []}
                            docType="bon_achat"
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
                    <Button type="submit" disabled={isLoading} className="bg-orange-600 hover:bg-orange-700">
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {defaultValues ? "Mettre à jour" : "Créer le bon d'achat"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => window.history.back()}>Annuler</Button>
                </div>
            </form>
        </Form>
    )
}
