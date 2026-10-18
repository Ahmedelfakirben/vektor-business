"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { salarieSchema, type SalarieFormData } from "@/lib/validations/master-data"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Loader2 } from "lucide-react"
import type { Salarie } from "@/types/database"

interface SalarieFormProps {
    defaultValues?: Salarie
    onSubmit: (data: SalarieFormData) => Promise<void>
    isLoading?: boolean
}

export function SalarieForm({ defaultValues, onSubmit, isLoading }: SalarieFormProps) {
    const form = useForm<SalarieFormData>({
        resolver: zodResolver(salarieSchema) as any,
        defaultValues: {
            matricule: defaultValues?.matricule || "",
            nom: defaultValues?.nom || "",
            prenom: defaultValues?.prenom || "",
            poste: defaultValues?.poste || "",
            telephone: defaultValues?.telephone || "",
            email: defaultValues?.email || "",
            date_embauche: defaultValues?.date_embauche || "",
            salaire: defaultValues?.salaire || 0,
            actif: defaultValues?.actif ?? true,
        },
    })

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Informations personnelles</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                        {defaultValues && (
                            <FormField
                                control={form.control}
                                name="matricule"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Matricule *</FormLabel>
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
                            name="nom"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nom *</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Nom de famille" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="prenom"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Prénom *</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Prénom" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="poste"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Poste</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Poste occupé" {...field} value={field.value || ""} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Contact & Contrat</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
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
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>E-mail</FormLabel>
                                    <FormControl>
                                        <Input type="email" placeholder="salarie@email.com" {...field} value={field.value || ""} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="date_embauche"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Date d&apos;embauche</FormLabel>
                                    <FormControl>
                                        <Input type="date" {...field} value={field.value || ""} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="salaire"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Salaire (DH)</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" {...field} value={field.value || ""} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="actif"
                            render={({ field }) => (
                                <FormItem className="flex items-center gap-3 space-y-0 pt-6">
                                    <FormControl>
                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                    <FormLabel>Salarié actif</FormLabel>
                                </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>

                <div className="flex gap-4">
                    <Button type="submit" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {defaultValues ? "Mettre à jour" : "Créer le salarié"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => window.history.back()}>
                        Annuler
                    </Button>
                </div>
            </form>
        </Form>
    )
}
