"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { usePaiements } from "@/hooks/use-paiements"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import {
    Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Loader2, PlusCircle, Calendar, Banknote, CreditCard, Landmark, FileText } from "lucide-react"
import { useTresoreries } from "@/hooks/use-tresoreries"

const paymentSchema = z.object({
    montant: z.coerce.number().min(0.01, "Le montant doit être positif"),
    date: z.string().min(1, "La date est requise"),
    mode_paiement: z.string().min(1, "Le mode est requis"),
    tresorerie_id: z.string().min(1, "La trésorerie est requise"),
    note: z.string().optional(),
    reference_paiement: z.string().optional(),
    date_echeance: z.string().optional(),
})

type PaymentFormData = z.infer<typeof paymentSchema>

interface PaymentDialogProps {
    referenceType: "bon_livraison" | "bon_achat" | "bon_retour" | "bon_retour_achat"
    referenceId: string
    resteAPayer: number
    onSuccess?: () => void
}

const paymentModes = [
    { value: "especes", label: "Espèces", icon: Banknote },
    { value: "carte", label: "Carte", icon: CreditCard },
    { value: "cheque", label: "Chèque", icon: Landmark },
    { value: "virement", label: "Virement", icon: Landmark },
    { value: "effet", label: "Effet", icon: FileText },
]

export function PaymentDialog({ referenceType, referenceId, resteAPayer, onSuccess }: PaymentDialogProps) {
    const [open, setOpen] = useState(false)
    const { create } = usePaiements(referenceType, referenceId)
    const { data: tresoreries } = useTresoreries()

    const form = useForm<PaymentFormData>({
        resolver: zodResolver(paymentSchema) as any,
        defaultValues: {
            montant: resteAPayer,
            date: new Date().toISOString().split("T")[0],
            mode_paiement: "especes",
            tresorerie_id: "",
            note: "",
            reference_paiement: "",
            date_echeance: "",
        },
    })

    const watchMode = form.watch("mode_paiement")
    const showRef = ["carte", "cheque", "virement", "effet"].includes(watchMode)
    const showDate = ["cheque", "effet"].includes(watchMode)

    async function onSubmit(data: PaymentFormData) {
        try {
            await create.mutateAsync({
                ...data,
                reference_type: referenceType,
                reference_id: referenceId,
            })
            setOpen(false)
            form.reset({
                montant: 0,
                date: new Date().toISOString().split("T")[0],
                mode_paiement: "especes",
                tresorerie_id: tresoreries?.[0]?.id || "",
                note: "",
                reference_paiement: "",
                date_echeance: "",
            })
            if (onSuccess) onSuccess()
        } catch (e) {
            // Toast handled by hook
        }
    }

    const handleOpenChange = (newOpen: boolean) => {
        if (newOpen) {
            form.setValue("montant", resteAPayer)
            if (!form.getValues("tresorerie_id") && tresoreries?.[0]) {
                form.setValue("tresorerie_id", tresoreries[0].id)
            }
        }
        setOpen(newOpen)
    }

    const isClient = ["bon_livraison", "bon_retour_achat"].includes(referenceType)
    const label = isClient ? "Encaisser" : "Payer"

    if (resteAPayer <= 0) return null

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button className="font-bold shadow-md hover:scale-105 transition-transform">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    {label}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-black">
                        <Landmark className="h-5 w-5 text-orange-600" />
                        {label} un monto / montant
                    </DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="montant"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Montant (Reste: {resteAPayer.toFixed(2)} MAD)</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Input type="number" step="0.01" {...field} className="h-10 font-bold text-orange-600 focus-visible:ring-orange-500" />
                                                <span className="absolute right-3 top-2.5 text-[10px] font-bold text-muted-foreground uppercase">DH</span>
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Date</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} className="h-10" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="mode_paiement"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Mode</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="h-10">
                                                    <SelectValue placeholder="Mode" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {paymentModes.map(m => (
                                                    <SelectItem key={m.value} value={m.value}>
                                                        <div className="flex items-center gap-2">
                                                            <m.icon className="h-3.5 w-3.5 text-muted-foreground" />
                                                            {m.label}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="tresorerie_id"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Trésorerie</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="h-10">
                                                    <SelectValue placeholder="Caisse/Banque" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {tresoreries?.map((t) => (
                                                    <SelectItem key={t.id} value={t.id}>
                                                        {t.libelle}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {(showRef || showDate) && (
                            <div className="grid grid-cols-1 gap-4 p-4 rounded-xl border bg-orange-50/10 border-orange-100 animate-in fade-in slide-in-from-top-2">
                                {showRef && (
                                    <FormField
                                        control={form.control}
                                        name="reference_paiement"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground ml-1">
                                                    {watchMode === "cheque" ? "N° de Chèque" : watchMode === "effet" ? "N° de l'effet" : "Réf. Transaction"}
                                                </FormLabel>
                                                <FormControl>
                                                    <Input placeholder="N°..." {...field} className="h-10" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}
                                {showDate && (
                                    <FormField
                                        control={form.control}
                                        name="date_echeance"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground ml-1 text-blue-600">Date d'échéance</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Input type="date" {...field} className="h-10 border-blue-100 bg-blue-50/20" />
                                                        <Calendar className="absolute right-3 top-3 h-4 w-4 text-blue-500 pointer-events-none" />
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}
                            </div>
                        )}

                        <FormField
                            control={form.control}
                            name="note"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Note (Optionnel)</FormLabel>
                                    <FormControl>
                                        <Textarea {...field} placeholder="Notes sur le règlement..." className="resize-none" rows={2} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <Button type="submit" className="w-full h-12 text-lg font-bold shadow-lg" disabled={create.isPending}>
                            {create.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Landmark className="mr-2 h-5 w-5" />}
                            Confirmar / Confirmer
                        </Button>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
