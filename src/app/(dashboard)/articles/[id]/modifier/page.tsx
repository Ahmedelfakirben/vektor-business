"use client"

import { useParams, useRouter } from "next/navigation"
import { useArticle, useUpdateArticle } from "@/hooks/use-articles"
import { ArticleForm } from "@/components/forms/article-form"
import type { ArticleFormData } from "@/lib/validations/master-data"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"

export default function ModifierArticlePage() {
    const params = useParams()
    const router = useRouter()
    const id = params.id as string
    const { data: article, isLoading } = useArticle(id)
    const updateArticle = useUpdateArticle()

    async function onSubmit(data: ArticleFormData) {
        try {
            await updateArticle.mutateAsync({ id, data })
            toast.success("Article mis à jour avec succès")
            router.push("/articles")
        } catch {
            toast.error("Erreur lors de la mise à jour de l'article")
        }
    }

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-96 w-full" />
            </div>
        )
    }

    if (!article) return <p>Article introuvable</p>

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Modifier l&apos;article</h2>
                <p className="text-muted-foreground">{article.designation}</p>
            </div>
            <ArticleForm
                defaultValues={article}
                onSubmit={onSubmit}
                isLoading={updateArticle.isPending}
            />
        </div>
    )
}
