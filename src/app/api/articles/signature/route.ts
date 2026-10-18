import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { extractVisualDescriptor } from "@/lib/visual-matcher"

export async function POST(req: NextRequest) {
  try {
    const { image, article_id } = await req.json()

    if (!image) {
      return NextResponse.json({ error: "Image requise" }, { status: 400 })
    }

    const signature = await extractVisualDescriptor(image)
    const serialized = JSON.stringify(signature)

    if (article_id) {
      const supabase = await createClient()

      // Try saving directly to articles table
      const { error: colError } = await (supabase.from("articles") as any)
        .update({ image_signature: serialized })
        .eq("id", article_id)

      // Also save to parametres cache as fallback
      try {
        const { data: cacheRow } = await (supabase.from("parametres") as any)
          .select("valeur")
          .eq("cle", "article_signatures_map")
          .maybeSingle()

        const map = cacheRow?.valeur ? JSON.parse(cacheRow.valeur) : {}
        map[article_id] = signature

        await (supabase.from("parametres") as any).upsert({
          cle: "article_signatures_map",
          valeur: JSON.stringify(map),
          description: "Cache des signatures visuelles des articles pour le TPV",
          updated_at: new Date().toISOString(),
        }, { onConflict: "cle" })
      } catch (cacheErr) {
        console.warn("Could not update parametres cache:", cacheErr)
      }

      if (colError && colError.code !== "42703") {
        console.warn("Could not save image_signature to articles:", colError)
      }
    }

    return NextResponse.json({
      success: true,
      signature,
    })
  } catch (err: any) {
    console.error("Signature extraction error:", err)
    return NextResponse.json(
      { error: "EXTRACTION_ERROR", message: err.message || "Erreur lors de l'extraction de la signature visuelle" },
      { status: 500 }
    )
  }
}

// Background sync route: generates and caches visual signatures for all existing catalogue items
export async function GET() {
  try {
    const supabase = await createClient()
    let articles: any[] = []
    const { data: withSig, error: errWithSig } = await supabase
      .from("articles")
      .select("id, designation, image_url, image_signature")
      .not("image_url", "is", null)
      .eq("actif", true)

    if (!errWithSig && withSig) {
      articles = withSig
    } else {
      const { data: withoutSig, error: errWithoutSig } = await supabase
        .from("articles")
        .select("id, designation, image_url")
        .not("image_url", "is", null)
        .eq("actif", true)
      if (errWithoutSig) throw errWithoutSig
      articles = withoutSig || []
    }

    const map: Record<string, number[]> = {}
    let processed = 0

    // Fetch existing cache from parametres if any
    try {
      const { data: cacheRow } = await (supabase.from("parametres") as any)
        .select("valeur")
        .eq("cle", "article_signatures_map")
        .maybeSingle()
      if (cacheRow?.valeur) {
        Object.assign(map, JSON.parse(cacheRow.valeur))
      }
    } catch {}

    for (const a of (articles || []) as any[]) {
      if (map[a.id] || a.image_signature) {
        if (a.image_signature && !map[a.id]) {
          try {
            map[a.id] = JSON.parse(a.image_signature)
          } catch {}
        }
        if (map[a.id] && !a.image_signature) {
          try {
            await (supabase.from("articles") as any)
              .update({ image_signature: JSON.stringify(map[a.id]) })
              .eq("id", a.id)
          } catch {}
        }
        continue
      }

      try {
        const sig = await extractVisualDescriptor(a.image_url)
        map[a.id] = sig
        processed++

        // Try persisting in articles table
        await (supabase.from("articles") as any)
          .update({ image_signature: JSON.stringify(sig) })
          .eq("id", a.id)
      } catch (e: any) {
        console.warn(`Could not compute signature for ${a.designation}:`, e.message)
      }
    }

    // Persist map in parametres cache
    await (supabase.from("parametres") as any).upsert({
      cle: "article_signatures_map",
      valeur: JSON.stringify(map),
      description: "Cache des signatures visuelles des articles pour le TPV",
      updated_at: new Date().toISOString(),
    }, { onConflict: "cle" })

    return NextResponse.json({
      success: true,
      total_in_cache: Object.keys(map).length,
      newly_processed: processed,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
