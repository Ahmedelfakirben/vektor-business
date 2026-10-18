"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { articleSchema, type ArticleFormData } from "@/lib/validations/master-data"
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
import { Switch } from "@/components/ui/switch"
import { Loader2, Scan, Upload, X, ImageIcon, Camera } from "lucide-react"
import { useFamilles } from "@/hooks/use-familles"
import { useSousFamillesByFamille } from "@/hooks/use-sous-familles"
import type { Article } from "@/types/database"
import { useEffect, useState, useRef } from "react"
import { BarcodeScanner } from "@/components/ui/barcode-scanner"
import { ArticleCameraModal } from "@/components/forms/article-camera-modal"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

interface ArticleFormProps {
    defaultValues?: Article
    onSubmit: (data: ArticleFormData) => Promise<void>
    isLoading?: boolean
}

export function ArticleForm({ defaultValues, onSubmit, isLoading }: ArticleFormProps) {
    const { data: familles } = useFamilles()
    const [isScanning, setIsScanning] = useState(false)
    const [isCameraModalOpen, setIsCameraModalOpen] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const form = useForm<ArticleFormData>({
        resolver: zodResolver(articleSchema) as any,
        defaultValues: {
            code: defaultValues?.code || "",
            reference: defaultValues?.reference || "",
            code_barre: defaultValues?.code_barre || "",
            designation: defaultValues?.designation || "",
            famille_id: defaultValues?.famille_id || "",
            sous_famille_id: defaultValues?.sous_famille_id || "",
            prix_achat: defaultValues?.prix_achat || 0,
            prix_vente: defaultValues?.prix_vente || 0,
            tva: defaultValues?.tva ?? 0,
            image_url: defaultValues?.image_url || "",
            unite: defaultValues?.unite || "unité",
            seuil_alerte: defaultValues?.seuil_alerte || 0,
            actif: defaultValues?.actif ?? true,
        },
    })

    const selectedFamilleId = form.watch("famille_id")
    const imageUrl = form.watch("image_url")
    const { data: sousFamilles } = useSousFamillesByFamille(selectedFamilleId || "")

    // Reset sous_famille if famille changes
    useEffect(() => {
        if (selectedFamilleId !== defaultValues?.famille_id) {
            form.setValue("sous_famille_id", "")
        }
    }, [selectedFamilleId, form, defaultValues])

    // Check if there is a photo prefill pending from POS scanner
    useEffect(() => {
        try {
            if (typeof window !== "undefined") {
                const pendingPhoto = sessionStorage.getItem("ai_product_prefill_image")
                if (pendingPhoto) {
                    sessionStorage.removeItem("ai_product_prefill_image")
                    fetch(pendingPhoto)
                        .then((r) => r.blob())
                        .then(async (blob) => {
                            const supabase = createClient()
                            const fileName = `article-${Date.now()}.jpeg`
                            const { error } = await supabase.storage.from("articles").upload(fileName, blob, {
                                contentType: "image/jpeg",
                                upsert: true,
                            })
                            if (!error) {
                                const { data: p } = supabase.storage.from("articles").getPublicUrl(fileName)
                                form.setValue("image_url", p.publicUrl, { shouldDirty: true })
                                fetch("/api/articles/signature", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ image: p.publicUrl }),
                                }).catch(() => {})
                            }
                        })
                        .catch(() => {})
                }
            }
        } catch {}
    }, [form])

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.size > 5 * 1024 * 1024) {
            toast.error("L'image ne doit pas dépasser 5 Mo")
            return
        }

        setIsUploading(true)
        try {
            const supabase = createClient()
            const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg"
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`

            const { error } = await supabase.storage
                .from("articles")
                .upload(fileName, file, { cacheControl: "3600", upsert: true })

            if (error) throw error

            const { data: publicData } = supabase.storage
                .from("articles")
                .getPublicUrl(fileName)

            form.setValue("image_url", publicData.publicUrl, { shouldDirty: true })

            // Compute and register visual signature in background
            try {
                fetch("/api/articles/signature", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ image: publicData.publicUrl, article_id: defaultValues?.id }),
                }).catch(() => {})
            } catch {}

            toast.success("Image téléchargée avec succès")
        } catch (error: any) {
            console.error("Upload error:", error)
            toast.error(error.message || "Erreur lors du téléchargement de l'image")
        } finally {
            setIsUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    const removeImage = () => {
        form.setValue("image_url", "", { shouldDirty: true })
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Photo de l&apos;article</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                            <div className="relative h-28 w-28 shrink-0 rounded-lg border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/30">
                                {imageUrl ? (
                                    <>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={imageUrl}
                                            alt="Aperçu article"
                                            className="h-full w-full object-cover"
                                        />
                                        <button
                                            type="button"
                                            onClick={removeImage}
                                            className="absolute top-1 right-1 h-6 w-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow-md hover:opacity-90"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </>
                                ) : (
                                    <div className="text-center p-2 text-muted-foreground">
                                        <ImageIcon className="h-8 w-8 mx-auto mb-1 opacity-50" />
                                        <span className="text-[10px]">Sans photo</span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2.5 flex-1 w-full">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleImageUpload}
                                    accept="image/*"
                                    className="hidden"
                                />
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsCameraModalOpen(true)}
                                        className="flex items-center gap-1.5 cursor-pointer font-medium"
                                    >
                                        <Camera className="h-4 w-4 text-primary" />
                                        <span>Prendre une photo (Caméra)</span>
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isUploading}
                                        className="flex items-center gap-1.5 cursor-pointer font-medium"
                                    >
                                        {isUploading ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Upload className="h-4 w-4" />
                                        )}
                                        <span>{imageUrl ? "Changer la photo" : "Télécharger une photo"}</span>
                                    </Button>
                                    {imageUrl && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={removeImage}
                                            className="text-destructive hover:text-destructive cursor-pointer"
                                        >
                                            Supprimer
                                        </Button>
                                    )}
                                </div>
                                <FormField
                                    control={form.control}
                                    name="image_url"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Input
                                                    placeholder="Ou collez l'URL directe d'une image (https://...)"
                                                    className="text-xs"
                                                    {...field}
                                                    value={field.value || ""}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <p className="text-[11px] text-muted-foreground">
                                    Formats acceptés : JPG, PNG, WEBP, GIF. Taille maximale : 5 Mo.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Informations générales</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                        {defaultValues && (
                            <FormField
                                control={form.control}
                                name="code"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Référence *</FormLabel>
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
                            name="code_barre"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Code Barre</FormLabel>
                                    <FormControl>
                                        <div className="flex gap-2">
                                            <Input placeholder="123456789..." {...field} value={field.value || ""} />
                                            <Button 
                                                type="button" 
                                                size="icon" 
                                                variant="outline" 
                                                onClick={() => setIsScanning(true)}
                                                className="shrink-0"
                                            >
                                                <Scan className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="designation"
                            render={({ field }) => (
                                <FormItem className="md:col-span-2">
                                    <FormLabel>Désignation *</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Nom de l'article" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="famille_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Famille</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Sélectionner une famille" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {familles?.map((f) => (
                                                <SelectItem key={f.id} value={f.id}>
                                                    {f.code} - {f.libelle}
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
                            name="sous_famille_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Sous-Famille</FormLabel>
                                    <Select 
                                        onValueChange={field.onChange} 
                                        value={field.value || undefined}
                                        disabled={!selectedFamilleId}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder={selectedFamilleId ? "Sélectionner une sous-famille" : "Sélectionnez d'abord une famille"} />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {sousFamilles?.map((sf) => (
                                                <SelectItem key={sf.id} value={sf.id}>
                                                    {sf.libelle}
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
                            name="unite"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Unité *</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Sélectionner" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="unité">Unité</SelectItem>
                                            <SelectItem value="kg">Kilogramme</SelectItem>
                                            <SelectItem value="litre">Litre</SelectItem>
                                            <SelectItem value="mètre">Mètre</SelectItem>
                                            <SelectItem value="m²">Mètre carré</SelectItem>
                                            <SelectItem value="lot">Lot</SelectItem>
                                            <SelectItem value="carton">Carton</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Tarification</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                        <FormField
                            control={form.control}
                            name="prix_achat"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Prix d&apos;achat (DH)</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="prix_vente"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Prix de vente (DH)</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Configuration supplémentaire</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                        <FormField
                            control={form.control}
                            name="seuil_alerte"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Seuil d&apos;alerte</FormLabel>
                                    <FormControl>
                                        <Input type="number" {...field} />
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
                                    <FormLabel>Article actif</FormLabel>
                                </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>

                <div className="flex gap-4">
                    <Button type="submit" disabled={isLoading || isUploading} className="bg-orange-600 hover:bg-orange-700">
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {defaultValues ? "Mettre à jour" : "Créer l'article"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => window.history.back()}>
                        Annuler
                    </Button>
                </div>
            </form>

            {isScanning && (
                <BarcodeScanner
                    onScan={(code) => {
                        form.setValue("code_barre", code)
                        setIsScanning(false)
                    }}
                    onClose={() => setIsScanning(false)}
                    title="Scanner le code barre"
                />
            )}

            <ArticleCameraModal
                isOpen={isCameraModalOpen}
                onClose={() => setIsCameraModalOpen(false)}
                onPhotoCaptured={(url) => {
                    form.setValue("image_url", url, { shouldDirty: true })
                }}
            />
        </Form>
    )
}
