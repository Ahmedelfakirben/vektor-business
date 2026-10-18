import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { extractVisualDescriptor, findTopMatches, VisualVector } from "@/lib/visual-matcher"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { image } = body

    if (!image) {
      return NextResponse.json(
        { error: "MISSING_IMAGE", message: "Aucune image fournie pour l'analyse" },
        { status: 400 }
      )
    }

    // 1. Extract visual descriptor from captured photo (Non-AI, 100% deterministic)
    const queryVector = await extractVisualDescriptor(image)

    const supabase = await createClient()

    // 2. Fetch active articles with image_url and image_signature
    let rawArticles: any[] = []
    const { data: withSig, error: errWithSig } = await supabase
      .from("articles")
      .select("id, code, code_barre, designation, prix_vente, unite, image_url, actif, image_signature")
      .eq("actif", true)

    if (!errWithSig && withSig) {
      rawArticles = withSig
    } else {
      const { data: withoutSig, error: errWithoutSig } = await supabase
        .from("articles")
        .select("id, code, code_barre, designation, prix_vente, unite, image_url, actif")
        .eq("actif", true)

      if (errWithoutSig) {
        console.error("Error fetching articles for visual search:", errWithoutSig)
        return NextResponse.json(
          { error: "DB_ERROR", message: "Erreur lors de la récupération du catalogue" },
          { status: 500 }
        )
      }
      rawArticles = withoutSig || []
    }

    if (rawArticles.length === 0) {
      return NextResponse.json(
        { error: "EMPTY_CATALOG", message: "Le catalogue d'articles est vide" },
        { status: 404 }
      )
    }

    // 3. Load precomputed signatures from parametres cache
    let signaturesMap: Record<string, VisualVector> = {}
    try {
      const { data: cacheRow } = await (supabase.from("parametres") as any)
        .select("valeur")
        .eq("cle", "article_signatures_map")
        .maybeSingle()
      if (cacheRow?.valeur) {
        signaturesMap = JSON.parse(cacheRow.valeur)
      }
    } catch (e) {
      console.warn("Could not read article_signatures_map:", e)
    }

    // 4. Build catalog with signatures
    const catalogWithSignatures: Array<{ article: any; signature: VisualVector }> = []

    for (const a of rawArticles) {
      let sig = signaturesMap[a.id]

      // Prioritize column if not already in cache
      if (!sig && a.image_signature) {
        try {
          sig = JSON.parse(a.image_signature)
          signaturesMap[a.id] = sig
        } catch {}
      }

      // If not in cache but has image_url, compute and cache it on the fly
      if (!sig && a.image_url) {
        try {
          sig = await extractVisualDescriptor(a.image_url)
          signaturesMap[a.id] = sig
        } catch {}
      }

      if (sig && Array.isArray(sig) && sig.length > 0) {
        catalogWithSignatures.push({ article: a, signature: sig })
      }
    }

    if (catalogWithSignatures.length === 0) {
      return NextResponse.json({
        success: true,
        matched: false,
        match: null,
        confidence: 0,
        candidates: [],
        message: "Aucun article avec photo n'a de signature visuelle enregistrée.",
      })
    }

    // 5. Match with Cosine Distance
    const topMatches = findTopMatches(queryVector, catalogWithSignatures, 5)

    const best = topMatches[0]
    const isMatched = best ? best.similarity >= 0.70 : false
    const matchedArticle = isMatched ? best.article : null

    const candidates = topMatches
      .filter((m) => m.article.id !== matchedArticle?.id)
      .map((m) => ({
        ...m.article,
        similarity_percentage: m.percentage,
        is_high_confidence: m.isHighConfidence,
      }))

    return NextResponse.json({
      success: true,
      matched: !!matchedArticle,
      match: matchedArticle,
      confidence: best ? best.percentage : 0,
      detected_name: matchedArticle?.designation || (best ? best.article.designation : ""),
      detected_text: "",
      reasoning: best
        ? `Correspondance visuelle directe (${best.percentage}%)`
        : "Aucune correspondance visuelle concluante",
      candidates,
    })
  } catch (err: any) {
    console.error("Unexpected error in visual product matcher:", err)
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: err.message || "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
