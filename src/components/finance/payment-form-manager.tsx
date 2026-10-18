"use client"

import { useFieldArray, Control, UseFormWatch, UseFormSetValue } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Plus, Trash2, Calendar, CreditCard, Banknote, Landmark, FileText } from "lucide-react"
import { useTresoreries } from "@/hooks/use-tresoreries"
import { cn } from "@/lib/utils"

interface PaymentFormManagerProps {
    control: Control<any>
    watch: UseFormWatch<any>
    setValue: UseFormSetValue<any>
    totalTTC: number
}

const paymentModes = [
    { value: "especes", label: "Espèces", icon: Banknote },
    { value: "carte", label: "Carte", icon: CreditCard },
    { value: "cheque", label: "Chèque", icon: Landmark },
    { value: "virement", label: "Virement", icon: Landmark },
    { value: "effet", label: "Effet", icon: FileText },
]

export function PaymentFormManager({ control, watch, setValue, totalTTC }: PaymentFormManagerProps) {
    const { fields, append, remove } = useFieldArray({
        control,
        name: "paiements",
    })

    const { data: tresoreries } = useTresoreries()
    const paiements = watch("paiements") || []
    const totalPaye = paiements.reduce((sum: number, p: any) => sum + (parseFloat(p.montant) || 0), 0)
    const resteAPayer = Math.max(0, totalTTC - totalPaye)

    const addPayment = () => {
        append({
            date: new Date().toISOString().split('T')[0],
            montant: resteAPayer,
            mode_paiement: "especes",
            tresorerie_id: tresoreries?.[0]?.id || "",
            reference_paiement: "",
            date_echeance: "",
            note: "",
        })
    }

    return (
        <Card className="border-orange-200 bg-orange-50/10">
            <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <Landmark className="h-5 w-5 text-orange-600" />
                            Règlements & Paiements
                        </h3>
                        <p className="text-sm text-muted-foreground mt-0.5">Saisir un ou plusieurs modes de paiement</p>
                    </div>
                    <div className="text-right">
                        <div className="text-sm text-muted-foreground">Total à régler</div>
                        <div className="text-2xl font-black text-foreground">{totalTTC.toFixed(2)} DH</div>
                    </div>
                </div>

                <div className="space-y-4">
                    {fields.map((field, index) => {
                        const mode = watch(`paiements.${index}.mode_paiement`)
                        const showRef = ["carte", "cheque", "virement", "effet"].includes(mode)
                        const showDate = ["cheque", "effet"].includes(mode)

                        return (
                            <div key={field.id} className="relative p-5 rounded-xl border bg-card shadow-sm animate-in fade-in zoom-in-95 duration-200">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm"
                                    onClick={() => remove(index)}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Mode</Label>
                                        <Select 
                                            value={mode} 
                                            onValueChange={(val) => setValue(`paiements.${index}.mode_paiement`, val)}
                                        >
                                            <SelectTrigger className="h-9">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {paymentModes.map((m) => (
                                                    <SelectItem key={m.value} value={m.value}>
                                                        <div className="flex items-center gap-2">
                                                            <m.icon className="h-3.5 w-3.5 text-muted-foreground" />
                                                            {m.label}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Trésorerie</Label>
                                        <Select
                                            value={watch(`paiements.${index}.tresorerie_id`)}
                                            onValueChange={(val) => setValue(`paiements.${index}.tresorerie_id`, val)}
                                        >
                                            <SelectTrigger className="h-9">
                                                <SelectValue placeholder="Choisir..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {tresoreries?.map((t) => (
                                                    <SelectItem key={t.id} value={t.id}>{t.libelle}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Montant</Label>
                                        <div className="relative">
                                            <Input
                                                type="number"
                                                step="0.01"
                                                className="h-9 font-bold text-orange-600 focus-visible:ring-orange-500"
                                                {...control.register(`paiements.${index}.montant`, { valueAsNumber: true })}
                                            />
                                            <span className="absolute right-3 top-2 text-[10px] font-bold text-muted-foreground">DH</span>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Date</Label>
                                        <div className="relative">
                                            <Input
                                                type="date"
                                                className="h-9 px-3"
                                                {...control.register(`paiements.${index}.date`)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {(showRef || showDate) && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-dashed">
                                        {showRef && (
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">
                                                    {mode === "cheque" ? "N° de Chèque" : mode === "effet" ? "N° de l'effet" : "Réf. Transaction"}
                                                </Label>
                                                <Input
                                                    placeholder="Optionnel..."
                                                    className="h-8 text-xs h-9"
                                                    {...control.register(`paiements.${index}.reference_paiement`)}
                                                />
                                            </div>
                                        )}
                                        {showDate && (
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Date d'échéance / Vencimiento</Label>
                                                <div className="relative">
                                                    <Input
                                                        type="date"
                                                        className="h-9 px-3 border-blue-200 bg-blue-50/30"
                                                        {...control.register(`paiements.${index}.date_echeance`)}
                                                    />
                                                    <Calendar className="absolute right-3 top-2.5 h-4 w-4 text-blue-500 pointer-events-none" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}

                    <Button
                        type="button"
                        variant="outline"
                        className="w-full h-10 border-dashed border-2 hover:bg-orange-100 hover:border-orange-500 hover:text-orange-600 transition-all font-semibold"
                        onClick={addPayment}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Ajouter un règlement
                    </Button>
                </div>

                <div className="mt-8 pt-6 border-t flex flex-col items-end gap-2">
                    <div className="flex justify-between w-full md:max-w-xs text-sm">
                        <span className="text-muted-foreground uppercase font-bold tracking-tight text-[10px]">Déjà payé</span>
                        <span className="font-bold">{totalPaye.toFixed(2)} DH</span>
                    </div>
                    <div className="flex justify-between w-full md:max-w-xs items-center">
                        <span className={cn(
                            "uppercase font-black tracking-widest text-[11px]",
                            resteAPayer > 0 ? "text-destructive" : "text-green-600"
                        )}>
                            {resteAPayer > 0 ? "Reste à payer" : "Solde réglé"}
                        </span>
                        <span className={cn(
                            "text-xl font-black",
                            resteAPayer > 0 ? "text-destructive" : "text-green-600"
                        )}>
                            {resteAPayer.toFixed(2)} DH
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
