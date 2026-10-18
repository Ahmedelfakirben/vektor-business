"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LoadingScreen } from "@/components/ui/loading-screen"
import { Wallet, Calendar, AlertCircle, CheckCircle2, Clock } from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { cn } from "@/lib/utils"

export default function PortefeuillePage() {
    const supabase = createClient()

    const { data: paiements, isLoading } = useQuery({
        queryKey: ["portefeuille"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("paiements")
                .select("*, tresorerie:tresoreries(*)")
                .in("mode_paiement", ["cheque", "effet"])
                .order("date_echeance", { ascending: true })
            if (error) throw error
            return data as any[]
        }
    })

    if (isLoading) return <LoadingScreen />

    const cheques = paiements?.filter(p => p.mode_paiement === "cheque") || []
    const effets = paiements?.filter(p => p.mode_paiement === "effet") || []

    const totalEntrant = paiements?.filter(p => !["bon_achat", "bon_retour", "depense"].includes(p.reference_type))
        .reduce((s, p) => s + p.montant, 0) || 0
    const totalSortant = paiements?.filter(p => ["bon_achat", "bon_retour", "depense"].includes(p.reference_type))
        .reduce((s, p) => s + p.montant, 0) || 0

    const today = new Date().toISOString().split('T')[0]
    const chequesEnRetard = cheques.filter(c => c.date_echeance && c.date_echeance < today).length
    const effetsEnRetard = effets.filter(e => e.date_echeance && e.date_echeance < today).length

    const PaymentTable = ({ data }: { data: any[] }) => (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Date Op.</TableHead>
                    <TableHead>Référence</TableHead>
                    <TableHead>Trésorerie</TableHead>
                    <TableHead>Échéance</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Statut</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {data.map((p) => {
                    const isOverdue = p.date_echeance && p.date_echeance < today
                    const isSortie = ["bon_achat", "bon_retour", "depense"].includes(p.reference_type)
                    return (
                        <TableRow key={p.id}>
                            <TableCell>{format(new Date(p.date), "dd MMM yyyy", { locale: fr })}</TableCell>
                            <TableCell className="font-medium">{p.reference_paiement || "—"}</TableCell>
                            <TableCell>{p.tresorerie?.libelle || "—"}</TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    {p.date_echeance ? format(new Date(p.date_echeance), "dd MMM yyyy", { locale: fr }) : "—"}
                                    {isOverdue && <AlertCircle className="h-4 w-4 text-destructive" />}
                                </div>
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex flex-col items-end">
                                    <span className={cn(
                                        "font-bold",
                                        isSortie ? "text-red-600" : "text-green-600"
                                    )}>
                                        {isSortie ? "-" : "+"}{p.montant.toLocaleString()} DH
                                    </span>
                                    <span className="text-[9px] uppercase font-bold text-muted-foreground italic">
                                        {isSortie ? "Sortant (Achat)" : "Entrant (Vente)"}
                                    </span>
                                </div>
                            </TableCell>
                            <TableCell>
                                {isOverdue ? (
                                    <Badge variant="destructive">En retard</Badge>
                                ) : (
                                    <Badge variant="outline" className="border-emerald-500 text-emerald-600">En cours</Badge>
                                )}
                            </TableCell>
                        </TableRow>
                    )
                })}
                {data.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            Aucun enregistrement trouvé
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    )

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-orange-600">Portefeuille Finance</h2>
                    <p className="text-muted-foreground">Gestion des chèques et effets en circulation</p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-green-200 bg-green-50/10">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-black uppercase text-green-700">À Encaisser / Entrants</CardTitle>
                        <Wallet className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-green-600">{totalEntrant.toLocaleString()} DH</div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Chèques & Effets clients</p>
                    </CardContent>
                </Card>
                <Card className="border-red-200 bg-red-50/10">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-black uppercase text-red-700">Émis / Sortants</CardTitle>
                        <AlertCircle className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-red-600">{totalSortant.toLocaleString()} DH</div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Titres payés aux fournisseurs</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-black uppercase">Échéances Dépassées</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-destructive">{chequesEnRetard + effetsEnRetard}</div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">À surveiller d'urgence</p>
                    </CardContent>
                </Card>
                <Card className="border-orange-500 bg-orange-500/10">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-black uppercase text-orange-700">Solde Portefeuille</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-orange-600">{(totalEntrant - totalSortant).toLocaleString()} DH</div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Disponibilité nette à terme</p>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="cheque" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="cheque">Chèques ({cheques.length})</TabsTrigger>
                    <TabsTrigger value="effet">Effets ({effets.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="cheque" className="border rounded-md bg-card">
                    <PaymentTable data={cheques} />
                </TabsContent>
                <TabsContent value="effet" className="border rounded-md bg-card">
                    <PaymentTable data={effets} />
                </TabsContent>
            </Tabs>
        </div>
    )
}
