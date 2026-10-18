"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { bonRetourAchatSchema, type BonRetourAchatFormData } from "@/lib/validations/documents"
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
import { useBonAchatsByFournisseur } from "@/hooks/use-bon-achats"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { RefreshCw } from "lucide-react"
import { useState } from "react"
import type { BonRetourAchat, Article } from "@/types/database"

interface BonRetourAchatFormProps {
    defaultValues?: BonRetourAchat
    onSubmit: (data: BonRetourAchatFormData) => Promise<void>
    isLoading?: boolean
}

export function BonRetourAchatForm({ defaultValues, onSubmit, isLoading }: BonRetourAchatFormProps) {
    const { data: fournisseurs } = useFournisseurs()
    const { data: depots } = useDepots()
    const { data: tresoreries } = useTresoreries()
    const supabase = createClient()
    const [isLoadingBA, setIsLoadingBA] = useState(false)
    const { data: articles } = useQuery({
        queryKey: ["articles-active"],
        queryFn: async () => {
            const { data, error } = await supabase.from("articles").select("*").eq("actif", true).order("designation")
            if (error) throw error
            return data as Article[]
        },
    })

    const form = useForm<BonRetourAchatFormData>({
        resolver: zodResolver(bonRetourAchatSchema) as any,
        defaultValues: {
            date: defaultValues?.date || new Date().toISOString().split("T")[0],
            fournisseur_id: defaultValues?.fournisseur_id || "",
            depot_id: defaultValues?.depot_id || "",
            motif: defaultValues?.motif || "",
            notes: defaultValues?.notes || "",
            inclure_tva: defaultValues?.inclure_tva || false,
            lignes: defaultValues?.lignes?.map((l) => ({
                article_id: l.article_id, designation: l.designation, quantite: l.quantite,
                prix_unitaire: l.prix_unitaire, tva: l.tva, montant_ht: l.montant_ht, 
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
                    <CardHeader><CardTitle>Informations du bon de retour achat</CardTitle></CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-3">
                        <FormField control={form.control} name="date" render={({ field }) => (
                            <FormItem><FormLabel>Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="fournisseur_id" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Fournisseur *</FormLabel>
                                <Select onValueChange={(val) => { field.onChange(val); form.setValue("bon_achat_id" as any, "") }} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner un fournisseur" /></SelectTrigger></FormControl>
                                    <SelectContent>{fournisseurs?.map((f) => (<SelectItem key={f.id} value={f.id}>{f.code} - {f.raison_sociale}</SelectItem>))}</SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name={"bon_achat_id" as any} render={({ field }) => {
                            const fournisseurId = form.watch("fournisseur_id")
                            const { data: bas } = useBonAchatsByFournisseur(fournisseurId)
                            
                            const handleLoadArticles = async () => {
                                if (!field.value) return
                                setIsLoadingBA(true)
                                try {
                                    const { data: baDoc, error: baError } = await (supabase
                                        .from("bon_achats") as any)
                                        .select("*, lignes:bon_achat_lignes(*)")
                                        .eq("id", field.value)
                                        .single()
                                    
                                    if (baError) throw baError
                                    if (baDoc && (baDoc as any).lignes) {
                                        const newLignes = (baDoc as any).lignes.map((l: any, i: number) => ({
                                            article_id: l.article_id,
                                            designation: l.designation,
                                            quantite: l.quantite,
                                            prix_unitaire: l.prix_unitaire,
                                            tva: l.tva,
                                            montant_ht: l.montant_ht,
                                            codes_articles: l.codes_articles || [],
                                            ordre: i,
                                        }))
                                        form.setValue("lignes", newLignes)
                                        form.setValue("inclure_tva", (baDoc as any).inclure_tva)
                                    }
                                } finally {
                                    setIsLoadingBA(false)
                                }
                            }

                            return (
                                <FormItem>
                                    <FormLabel>BA de référence (Optionnel)</FormLabel>
                                    <div className="flex gap-2">
                                        <Select onValueChange={field.onChange} value={field.value || ""}>
                                            <FormControl><SelectTrigger className="flex-1"><SelectValue placeholder={fournisseurId ? "Sélectionner un BA" : "Choisir un fournisseur d'abord"} /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="none">Aucun</SelectItem>
                                                {bas?.map((ba) => (<SelectItem key={ba.id} value={ba.id}>{ba.numero} ({ba.montant_ttc.toLocaleString()} DH)</SelectItem>))}
                                            </SelectContent>
                                        </Select>
                                        <Button 
                                            type="button" 
                                            variant="secondary" 
                                            size="icon"
                                            disabled={!field.value || field.value === "none" || isLoadingBA}
                                            onClick={handleLoadArticles}
                                            title="Charger les articles du BA"
                                        >
                                            {isLoadingBA ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )
                        }} />
                        <FormField control={form.control} name="depot_id" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Dépôt *</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    <CardHeader><CardTitle>Motif du retour</CardTitle></CardHeader>
                    <CardContent>
                        <FormField control={form.control} name="motif" render={({ field }) => (
                            <FormItem><FormControl><Textarea placeholder="Motif du retour au fournisseur..." rows={2} {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
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
                    <Button type="submit" disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{defaultValues ? "Mettre à jour" : "Créer le bon de retour achat"}</Button>
                    <Button type="button" variant="outline" onClick={() => window.history.back()}>Annuler</Button>
                </div>
            </form>
        </Form>
    )
}
