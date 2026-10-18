"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { bonRetourSchema, type BonRetourFormData } from "@/lib/validations/documents"
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
import { Switch } from "@/components/ui/switch"
import { DocumentLines } from "./document-lines"
import { PaymentFormManager } from "@/components/finance/payment-form-manager"
import { useClients } from "@/hooks/use-clients"
import { useDepots } from "@/hooks/use-depots"
import { useTresoreries } from "@/hooks/use-tresoreries"
import { useBonLivraisonsByClient, useBonLivraison } from "@/hooks/use-bon-livraisons"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Search, RefreshCw } from "lucide-react"
import { useState } from "react"
import type { BonRetour, Article } from "@/types/database"

interface BonRetourFormProps {
    defaultValues?: BonRetour
    onSubmit: (data: BonRetourFormData) => Promise<void>
    isLoading?: boolean
}

export function BonRetourForm({ defaultValues, onSubmit, isLoading }: BonRetourFormProps) {
    const { data: clients } = useClients()
    const { data: depots } = useDepots()
    const { data: tresoreries } = useTresoreries()
    const supabase = createClient()
    const [isLoadingBL, setIsLoadingBL] = useState(false)

    const { data: articles } = useQuery({
        queryKey: ["articles-active"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("articles")
                .select("*")
                .eq("actif", true)
                .order("designation")
            if (error) throw error
            return data as Article[]
        },
    })

    const form = useForm<BonRetourFormData>({
        resolver: zodResolver(bonRetourSchema) as any,
        defaultValues: {
            date: defaultValues?.date || new Date().toISOString().split("T")[0],
            client_id: defaultValues?.client_id || "",
            bon_livraison_id: defaultValues?.bon_livraison_id || "",
            depot_id: defaultValues?.depot_id || "",
            motif: defaultValues?.motif || "",
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
            })) || [
                    { article_id: null, designation: "", quantite: 1, prix_unitaire: 0, tva: 20, montant_ht: 0, codes_articles: [], ordre: 0 },
                ],
            paiements: [],
        },
    })

    const lignes = form.watch("lignes") || []
    const totalTTC = lignes.reduce((s, l) => s + (l.quantite || 0) * (l.prix_unitaire || 0), 0)

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-6">
                <Card>
                    <CardHeader><CardTitle>Informations du bon de retour</CardTitle></CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-3">
                        <FormField control={form.control} name="date" render={({ field }) => (
                            <FormItem><FormLabel>Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="client_id" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Client *</FormLabel>
                                <Select onValueChange={(val) => { field.onChange(val); form.setValue("bon_livraison_id", "") }} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger></FormControl>
                                    <SelectContent>{clients?.map((c) => (<SelectItem key={c.id} value={c.id}>{c.code} - {c.raison_sociale}</SelectItem>))}</SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="bon_livraison_id" render={({ field }) => {
                            const clientId = form.watch("client_id")
                            const { data: bls } = useBonLivraisonsByClient(clientId)
                            
                            const handleLoadArticles = async () => {
                                if (!field.value) return
                                setIsLoadingBL(true)
                                try {
                                    const { data: bl, error } = await supabase
                                        .from("bon_livraisons")
                                        .select("*, lignes:bon_livraison_lignes(*)")
                                        .eq("id", field.value)
                                        .single()
                                    
                                    if (error) throw error
                                    if (bl && (bl as any).lignes) {
                                        const newLignes = (bl as any).lignes.map((l: any, i: number) => ({
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
                                        form.setValue("inclure_tva", (bl as any).inclure_tva)
                                    }
                                } finally {
                                    setIsLoadingBL(false)
                                }
                            }

                            return (
                                <FormItem>
                                    <FormLabel>BL de référence (Optionnel)</FormLabel>
                                    <div className="flex gap-2">
                                        <Select onValueChange={field.onChange} value={field.value || ""}>
                                            <FormControl><SelectTrigger className="flex-1"><SelectValue placeholder={clientId ? "Sélectionner un BL" : "Choisir un client d'abord"} /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="none">Aucun</SelectItem>
                                                {bls?.map((bl) => (<SelectItem key={bl.id} value={bl.id}>{bl.numero} ({bl.montant_ttc.toLocaleString()} DH)</SelectItem>))}
                                            </SelectContent>
                                        </Select>
                                        <Button 
                                            type="button" 
                                            variant="secondary" 
                                            size="icon"
                                            disabled={!field.value || field.value === "none" || isLoadingBL}
                                            onClick={handleLoadArticles}
                                            title="Charger les articles du BL"
                                        >
                                            {isLoadingBL ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
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
                                    <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner un depósito" /></SelectTrigger></FormControl>
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
                            <FormItem><FormControl><Textarea placeholder="Motif du retour de marchandise..." rows={2} {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                        )} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Lignes</CardTitle></CardHeader>
                    <CardContent>
                        <DocumentLines
                            control={form.control as any}
                            watch={form.watch}
                            setValue={form.setValue}
                            articles={articles || []}
                        />
                        {form.formState.errors.lignes && (
                            <p className="text-sm text-destructive mt-2">{form.formState.errors.lignes.message || "Vérifiez les lignes"}</p>
                        )}
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
                    <Button type="submit" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {defaultValues ? "Mettre à jour" : "Créer le bon de retour"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => window.history.back()}>Annuler</Button>
                </div>
            </form>
        </Form>
    )
}
