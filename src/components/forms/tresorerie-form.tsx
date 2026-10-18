"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { tresorerieSchema, type TresorerieFormData } from "@/lib/validations/master-data"
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import type { Tresorerie } from "@/types/database"

interface TresorerieFormProps {
    defaultValues?: Tresorerie
    onSubmit: (data: TresorerieFormData) => Promise<void>
    isLoading?: boolean
}

export function TresorerieForm({ defaultValues, onSubmit, isLoading }: TresorerieFormProps) {
    const form = useForm<TresorerieFormData>({
        resolver: zodResolver(tresorerieSchema) as any,
        defaultValues: {
            code: defaultValues?.code || "",
            libelle: defaultValues?.libelle || "",
            type: defaultValues?.type || "caisse",
            solde: defaultValues?.solde || 0,
        },
    })

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Informations de la trésorerie</CardTitle>
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
                                        <Input placeholder="Nom de la trésorerie" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Type *</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Sélectionner le type" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="caisse">Caisse</SelectItem>
                                            <SelectItem value="banque">Banque</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="solde"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Solde initial (DH)</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>

                <div className="flex gap-4">
                    <Button type="submit" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {defaultValues ? "Mettre à jour" : "Créer la trésorerie"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => window.history.back()}>
                        Annuler
                    </Button>
                </div>
            </form>
        </Form>
    )
}
