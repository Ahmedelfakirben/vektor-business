"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { 
    ArrowUpCircle, 
    ArrowDownCircle, 
    History, 
    Package, 
    Calendar,
    User,
    Store
} from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

interface ArticleHistorySheetProps {
    articleId: string | null
    isOpen: boolean
    onOpenChange: (open: boolean) => void
}

export function ArticleHistorySheet({ articleId, isOpen, onOpenChange }: ArticleHistorySheetProps) {
    const supabase = createClient()

    const { data: history, isLoading } = useQuery({
        queryKey: ["article-history", articleId],
        queryFn: async () => {
            if (!articleId) return null
            const { data, error } = await supabase
                .from("mouvements_stock")
                .select("*, depot:depots(libelle)")
                .eq("article_id", articleId)
                .order("created_at", { ascending: false })
                .limit(50)
            
            if (error) throw error
            return data
        },
        enabled: !!articleId && isOpen
    })

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-md flex flex-col p-0">
                <SheetHeader className="p-6 pb-2">
                    <div className="flex items-center gap-3">
                        <div className="bg-orange-500/10 p-2 rounded-lg">
                            <History className="h-5 w-5 text-orange-600" />
                        </div>
                        <div>
                            <SheetTitle className="text-xl font-black italic">Historial del Artículo</SheetTitle>
                            <SheetDescription>Últimos 50 movimientos registrados.</SheetDescription>
                        </div>
                    </div>
                </SheetHeader>

                <ScrollArea className="flex-1 px-6">
                    {isLoading ? (
                        <div className="flex flex-col gap-4 py-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
                            ))}
                        </div>
                    ) : history && history.length > 0 ? (
                        <div className="relative space-y-4 py-4">
                            {/* Vertical Line */}
                            <div className="absolute left-[19px] top-6 bottom-6 w-0.5 bg-muted" />

                            {history.map((m: any) => (
                                <div key={m.id} className="relative pl-12">
                                    {/* Icon Marker */}
                                    <div className={cn(
                                        "absolute left-0 top-1 p-1.5 rounded-full border-2 bg-background z-10",
                                        m.type === "entree" ? "border-green-500 text-green-600" : "border-destructive text-destructive"
                                    )}>
                                        {m.type === "entree" ? <ArrowUpCircle className="h-4 w-4" /> : <ArrowDownCircle className="h-4 w-4" />}
                                    </div>

                                    <div className="p-4 rounded-xl border bg-card/50 hover:bg-card transition-colors shadow-sm">
                                        <div className="flex items-center justify-between mb-2">
                                            <Badge variant="outline" className={cn(
                                                "text-[10px] uppercase font-black tracking-widest px-1.5",
                                                m.type === "entree" ? "border-green-500/30 text-green-600 bg-green-50" : "border-destructive/30 text-destructive bg-red-50"
                                            )}>
                                                {m.type === "entree" ? "Entrada" : "Salida"}
                                            </Badge>
                                            <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                {format(new Date(m.created_at), "dd MMM yyyy HH:mm", { locale: fr })}
                                            </span>
                                        </div>

                                        <div className="flex items-baseline gap-2">
                                            <span className={cn(
                                                "text-xl font-black",
                                                m.type === "entree" ? "text-green-600" : "text-destructive"
                                            )}>
                                                {m.type === "entree" ? "+" : "-"}{m.quantite}
                                            </span>
                                            <span className="text-xs text-muted-foreground uppercase font-bold">unidades</span>
                                        </div>

                                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-muted-foreground font-medium border-t pt-2">
                                            <div className="flex items-center gap-1">
                                                <Store className="h-3 w-3 opacity-70" />
                                                {m.depot?.libelle}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Package className="h-3 w-3 opacity-70" />
                                                <span className="truncate max-w-[120px]">{m.reference_type?.replace('_', ' ')}</span>
                                            </div>
                                            {m.inclure_tva && (
                                                <Badge className="bg-orange-500/10 text-orange-600 border-none text-[8px] h-3 px-1 uppercase">Fiscal</Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                            <History className="h-12 w-12 text-muted-foreground/20 mb-4" />
                            <p className="text-muted-foreground">No se encontraron movimientos para este artículo.</p>
                        </div>
                    )}
                </ScrollArea>
            </SheetContent>
        </Sheet>
    )
}
