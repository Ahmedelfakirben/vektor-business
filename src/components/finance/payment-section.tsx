"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PaymentDialog } from "./payment-dialog"
import { PaymentHistory } from "./payment-history"
import { Progress } from "@/components/ui/progress"

interface PaymentSectionProps {
    referenceType: "bon_livraison" | "bon_achat" | "bon_retour" | "bon_retour_achat"
    referenceId: string
    montantTTC: number
    montantRegle: number
    statutPaiement: string
    readOnly?: boolean
}

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    paye: "default", // Green-ish usually default or success
    partiel: "secondary", // Orange-ish
    impaye: "destructive", // Red
}

const statusLabels: Record<string, string> = {
    paye: "Payé",
    partiel: "Partiel",
    impaye: "Impayé",
}

export function PaymentSection({ referenceType, referenceId, montantTTC, montantRegle = 0, statutPaiement = "impaye", readOnly = false }: PaymentSectionProps) {
    const resteAPayer = Math.max(0, montantTTC - montantRegle)
    const percentage = Math.min(100, (montantRegle / montantTTC) * 100) || 0

    return (
        <Card className="mt-6">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xl font-bold">Paiements & Règlements</CardTitle>
                <Badge variant={statusColors[statutPaiement] || "outline"}>
                    {statusLabels[statutPaiement] || statutPaiement}
                </Badge>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    {/* Summary & Progress */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span>Progression</span>
                            <span className="font-medium">{percentage.toFixed(0)}% réglé</span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                        <div className="flex justify-between text-sm text-muted-foreground pt-1">
                            <span>Déjà réglé : <span className="text-foreground font-medium">{montantRegle.toFixed(2)} MAD</span></span>
                            <span>Reste à payer : <span className="text-destructive font-bold">{resteAPayer.toFixed(2)} MAD</span></span>
                        </div>
                    </div>

                    {/* Actions */}
                    {!readOnly && resteAPayer > 0 && (
                        <div className="flex justify-end">
                            <PaymentDialog
                                referenceType={referenceType}
                                referenceId={referenceId}
                                resteAPayer={resteAPayer}
                            />
                        </div>
                    )}

                    {/* History */}
                    <div>
                        <h4 className="text-sm font-semibold mb-3">Historique des transactions</h4>
                        <PaymentHistory
                            referenceType={referenceType}
                            referenceId={referenceId}
                            readOnly={readOnly}
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
