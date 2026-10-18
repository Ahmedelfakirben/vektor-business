"use client"

import { useRouter } from "next/navigation"
import { useCreateArticle } from "@/hooks/use-articles"
import { ArticleForm } from "@/components/forms/article-form"
import type { ArticleFormData } from "@/lib/validations/master-data"
import { toast } from "sonner"

export const dynamic = "force-dynamic"

export default function NouvelArticlePage() {
    const router = useRouter()
    const createArticle = useCreateArticle()

    async function onSubmit(data: ArticleFormData) {
        try {
            await createArticle.mutateAsync(data)
            toast.success("Article créé avec succès")
            router.push("/articles")
        } catch {
            toast.error("Erreur lors de la création de l'article")
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Nouvel article</h2>
                <p className="text-muted-foreground">Créer un nouvel article</p>
            </div>
            <ArticleForm onSubmit={onSubmit} isLoading={createArticle.isPending} />
        </div>
    )
}
