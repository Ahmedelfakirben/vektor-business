"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import Link from "next/link"
import { ExternalLink, History } from "lucide-react"

interface MouvementHistoryDialogProps {
    articleId: string | null
    depotId: string | null
    articleDesignation: string
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function MouvementHistoryDialog({ 
    articleId, 
    depotId, 
    articleDesignation, 
    open, 
    onOpenChange 
}: MouvementHistoryDialogProps) {
    const supabase = createClient()

    const { data: movements, isLoading } = useQuery({
        queryKey: ["article-movements", articleId, depotId],
        queryFn: async () => {
            if (!articleId) return []
            let query = supabase
                .from("mouvements_stock")
                .select("*")
                .eq("article_id", articleId)
                .order("created_at", { ascending: false })
            
            if (depotId) {
                query = query.eq("depot_id", depotId)
            }

            const { data, error } = await query
            if (error) throw error
            return data
        },
        enabled: !!articleId && open
    })

    const getSourceLink = (type: string, id: string) => {
        switch (type) {
            case "bon_livraison": return `/bon-livraisons/${id}`
            case "bon_achat": return `/bon-achats/${id}`
            case "bon_retour": return `/bon-retours/${id}`
            case "bon_retour_achat": return `/bon-retour-achats/${id}`
            case "vente_pos": return `/historique-pos/${id}`
            case "devis": return `/devis/${id}`
            default: return null
        }
    }

    const getSourceLabel = (type: string) => {
        return type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-black italic uppercase">
                        <History className="h-6 w-6 text-orange-600" />
                        Historique : {articleDesignation}
                    </DialogTitle>
                </DialogHeader>

                {isLoading ? (
                    <div className="space-y-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                ) : (
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="font-black text-[10px] uppercase">Date</TableHead>
                                <TableHead className="font-black text-[10px] uppercase">Type</TableHead>
                                <TableHead className="text-right font-black text-[10px] uppercase">Quantité</TableHead>
                                <TableHead className="font-black text-[10px] uppercase">Source (Cliquable)</TableHead>
                                <TableHead className="font-black text-[10px] uppercase">Note</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {movements?.map((m: any) => {
                                const link = getSourceLink(m.reference_type, m.reference_id)
                                return (
                                    <TableRow key={m.id} className="hover:bg-muted/30">
                                        <TableCell className="text-[10px] font-mono text-muted-foreground uppercase">
                                            {format(new Date(m.created_at), "dd MMM HH:mm", { locale: fr })}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={m.type === "entree" ? "default" : "destructive"} className="text-[9px] font-black uppercase">
                                                {m.type === "entree" ? "ENTRÉE" : "SORTIE"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-black">
                                            {m.type === "entree" ? "+" : "-"}{m.quantite}
                                        </TableCell>
                                        <TableCell>
                                            {link ? (
                                                <Link 
                                                    href={link}
                                                    className="flex items-center gap-1.5 text-xs font-bold text-orange-600 hover:underline"
                                                >
                                                    <ExternalLink className="h-3 w-3" />
                                                    {getSourceLabel(m.reference_type)}
                                                </Link>
                                            ) : (
                                                <span className="text-xs text-muted-foreground italic">
                                                    {getSourceLabel(m.reference_type)}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-[10px] text-muted-foreground italic truncate max-w-[200px]">
                                            {m.note || "—"}
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                            {movements?.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                                        Aucun mouvement trouvé.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                )}
            </DialogContent>
        </Dialog>
    )
}
