"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BarcodeScanner } from "@/components/ui/barcode-scanner"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Camera, Check, Plus, Trash2, AlertCircle } from "lucide-react"
import { toast } from "sonner"

interface CodesEntryModalProps {
    isOpen: boolean
    onClose: () => void
    onSave: (codes: string[]) => void
    initialCodes: string[]
    quantity: number
    label: string // e.g. "IMEI", "Serial Number"
    articleDesignation: string
}

export function CodesEntryModal({ isOpen, onClose, onSave, initialCodes, quantity, label, articleDesignation }: CodesEntryModalProps) {
    const [codes, setCodes] = useState<string[]>(Array(quantity).fill(""))
    const [isScannerOpen, setIsScannerOpen] = useState(false)
    const [activeIndex, setActiveIndex] = useState(0)

    useEffect(() => {
        if (isOpen) {
            const newCodes = [...Array(quantity).fill("")]
            initialCodes.forEach((c, i) => {
                if (i < quantity) newCodes[i] = c
            })
            setCodes(newCodes)
            
            // Auto-focus first empty
            const firstEmpty = newCodes.findIndex(c => !c)
            setActiveIndex(firstEmpty === -1 ? 0 : firstEmpty)
        }
    }, [isOpen, initialCodes, quantity])

    const handleCodeChange = (index: number, value: string) => {
        const newCodes = [...codes]
        newCodes[index] = value
        setCodes(newCodes)
    }

    const handleScan = (decodedText: string) => {
        // Find if code already exists
        if (codes.includes(decodedText)) {
            toast.warning("Ce code est déjà scanné")
            return
        }

        const newCodes = [...codes]
        newCodes[activeIndex] = decodedText
        setCodes(newCodes)

        // Move to next empty slot
        const nextIndex = newCodes.findIndex((c, i) => i > activeIndex && !c)
        if (nextIndex !== -1) {
            setActiveIndex(nextIndex)
        } else {
            // Check if there's any empty slot anywhere
            const anyEmpty = newCodes.findIndex(c => !c)
            if (anyEmpty !== -1) {
                setActiveIndex(anyEmpty)
            } else {
                toast.success("Tous los códigos han sido escaneados")
                setIsScannerOpen(false)
            }
        }
    }

    const handleSave = () => {
        const filledCodes = codes.filter(c => c.trim() !== "")
        if (filledCodes.length < quantity) {
            toast.error(`Veuillez saisir les ${quantity} codes requis`)
            return
        }
        onSave(filledCodes)
        onClose()
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl p-0 overflow-hidden bg-background rounded-xl shadow-2xl border flex flex-col max-h-[90vh]">
                <DialogHeader className="p-6 border-b bg-muted/20">
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle className="text-xl font-bold">Traceabilidad - {articleDesignation}</DialogTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                                Escaneé o introduzca los {quantity} {label} requeridos
                            </p>
                        </div>
                        <div className="bg-orange-500/10 text-orange-600 px-3 py-1 rounded-full text-sm font-bold border border-orange-500/20">
                            {codes.filter(c => c).length} / {quantity}
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-0 flex-1 overflow-hidden flex flex-col md:flex-row">
                    {/* Left: Progress & Quick Scan */}
                    <div className="flex w-full md:w-48 flex-col border-b md:border-b-0 md:border-r bg-muted/10 p-4 gap-4">
                        <Button 
                            className="w-full bg-orange-500 hover:bg-orange-600 h-24 flex-col gap-2 shadow-lg shadow-orange-500/20 rounded-xl"
                            onClick={() => setIsScannerOpen(true)}
                        >
                            <Camera className="h-8 w-8" />
                            <span>Escaneo Continuo</span>
                        </Button>
                        <div className="mt-auto p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-600 text-xs flex gap-2">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <p>El escáner pasará automáticamente al siguiente campo tras cada lectura.</p>
                        </div>
                    </div>

                    {/* Right: Manual Grid */}
                    <ScrollArea className="flex-1 p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {codes.map((code, idx) => (
                                <div 
                                    key={idx} 
                                    className={`relative p-3 rounded-lg border-2 transition-all cursor-pointer ${activeIndex === idx ? "border-orange-500 bg-orange-500/5 ring-4 ring-orange-500/10" : "border-border"}`}
                                    onClick={() => setActiveIndex(idx)}
                                >
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">
                                        {label} #{idx + 1}
                                    </Label>
                                    <div className="flex gap-2">
                                        <Input
                                            value={code}
                                            onChange={(e) => handleCodeChange(idx, e.target.value)}
                                            placeholder={`Saisir ${label}...`}
                                            className="h-8 text-sm font-mono border-none bg-transparent p-0 focus-visible:ring-0 shadow-none cursor-text"
                                            autoFocus={activeIndex === idx}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                        {code && <Check className="h-4 w-4 text-green-500 shrink-0 mt-1.5" />}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>

                <DialogFooter className="p-6 border-t bg-muted/5 gap-3">
                    <Button variant="outline" onClick={onClose} className="rounded-lg">Annuler</Button>
                    <Button onClick={handleSave} className="bg-primary hover:bg-primary/90 px-8 rounded-lg">
                        Valider los {quantity} códigos
                    </Button>
                </DialogFooter>

                {isScannerOpen && (
                    <div className="fixed inset-0 z-[60]">
                        <BarcodeScanner 
                            onScan={handleScan}
                            onClose={() => setIsScannerOpen(false)}
                            title={`Escaneando ${label} ${activeIndex + 1}/${quantity}`}
                        />
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
