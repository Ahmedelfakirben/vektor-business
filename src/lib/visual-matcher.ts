import sharp from "sharp"

/**
 * Visual Descriptor Extractor (Non-AI Computer Vision)
 * Uses Multi-Zone Spatial YCbCr Color Distribution + Sobel Edge Gradient Orientations.
 * Normalized to L2 unit length for instant Cosine Similarity calculations.
 */

export type VisualVector = number[]

export interface MatchCandidate {
  article: {
    id: string
    code: string
    designation: string
    prix_vente: number
    image_url?: string | null
    code_barre?: string | null
    stock_actuel?: number
  }
  similarity: number
  percentage: number
  isHighConfidence: boolean
}

/**
 * Extract a normalized 160-dimensional spatial visual signature from an image
 * @param input Image buffer, raw base64 string, data URI, or URL
 */
export async function extractVisualDescriptor(input: Buffer | string): Promise<VisualVector> {
  let imageBuffer: Buffer

  if (typeof input === "string") {
    if (input.startsWith("data:")) {
      const base64Data = input.replace(/^data:image\/\w+;base64,/, "")
      imageBuffer = Buffer.from(base64Data, "base64")
    } else if (input.startsWith("http://") || input.startsWith("https://")) {
      const res = await fetch(input)
      if (!res.ok) throw new Error(`Impossible de télécharger l'image depuis ${input}`)
      const arrayBuffer = await res.arrayBuffer()
      imageBuffer = Buffer.from(arrayBuffer)
    } else {
      imageBuffer = Buffer.from(input, "base64")
    }
  } else {
    imageBuffer = input
  }

  // 1. Resize and normalize image to 64x64 raw RGB buffer
  const { data, info } = await sharp(imageBuffer)
    .resize(64, 64, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const width = info.width
  const height = info.height
  const channels = info.channels // 3 (R, G, B)

  // Convert RGB to YCbCr (separates illumination from chromatic tints)
  const Y = new Float32Array(width * height)
  const Cb = new Float32Array(width * height)
  const Cr = new Float32Array(width * height)

  for (let i = 0; i < width * height; i++) {
    const r = data[i * channels]
    const g = data[i * channels + 1]
    const b = data[i * channels + 2]

    Y[i] = 0.299 * r + 0.587 * g + 0.114 * b
    Cb[i] = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
    Cr[i] = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
  }

  // Sobel edge gradients on Luma Y
  const Gx = new Float32Array(width * height)
  const Gy = new Float32Array(width * height)

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x
      const gx =
        -Y[idx - width - 1] + Y[idx - width + 1] +
        -2 * Y[idx - 1] + 2 * Y[idx + 1] +
        -Y[idx + width - 1] + Y[idx + width + 1]
      const gy =
        -Y[idx - width - 1] - 2 * Y[idx - width] - Y[idx - width + 1] +
        Y[idx + width - 1] + 2 * Y[idx + width] + Y[idx + width + 1]
      Gx[idx] = gx
      Gy[idx] = gy
    }
  }

  // 4x4 spatial grid (16 blocks, each 16x16 pixels)
  const gridSize = 4
  const blockW = Math.floor(width / gridSize)
  const blockH = Math.floor(height / gridSize)
  const vector: number[] = []

  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      const startX = gx * blockW
      const endX = startX + blockW
      const startY = gy * blockH
      const endY = startY + blockH
      const pixelCount = (endX - startX) * (endY - startY)

      let sumY = 0, sumCb = 0, sumCr = 0
      let sumY2 = 0, sumCb2 = 0, sumCr2 = 0
      let edgeH = 0, edgeV = 0, edgeD1 = 0, edgeD2 = 0

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = y * width + x
          const yVal = Y[idx]
          const cbVal = Cb[idx]
          const crVal = Cr[idx]

          sumY += yVal
          sumCb += cbVal
          sumCr += crVal
          sumY2 += yVal * yVal
          sumCb2 += cbVal * cbVal
          sumCr2 += crVal * crVal

          const dx = Gx[idx]
          const dy = Gy[idx]
          const mag = Math.sqrt(dx * dx + dy * dy)

          if (mag > 15) {
            if (Math.abs(dx) > Math.abs(dy) * 1.5) edgeH += mag
            else if (Math.abs(dy) > Math.abs(dx) * 1.5) edgeV += mag
            else if ((dx > 0 && dy > 0) || (dx < 0 && dy < 0)) edgeD1 += mag
            else edgeD2 += mag
          }
        }
      }

      const meanY = sumY / pixelCount
      const meanCb = sumCb / pixelCount
      const meanCr = sumCr / pixelCount

      const stdY = Math.sqrt(Math.max(0, sumY2 / pixelCount - meanY * meanY))
      const stdCb = Math.sqrt(Math.max(0, sumCb2 / pixelCount - meanCb * meanCb))
      const stdCr = Math.sqrt(Math.max(0, sumCr2 / pixelCount - meanCr * meanCr))

      vector.push(
        meanY / 255,
        meanCb / 255,
        meanCr / 255,
        stdY / 128,
        stdCb / 128,
        stdCr / 128,
        edgeH / (pixelCount * 50),
        edgeV / (pixelCount * 50),
        edgeD1 / (pixelCount * 50),
        edgeD2 / (pixelCount * 50)
      )
    }
  }

  // Normalize to unit length (L2 norm)
  let norm = 0
  for (let i = 0; i < vector.length; i++) {
    norm += vector[i] * vector[i]
  }
  norm = Math.sqrt(norm) || 1
  for (let i = 0; i < vector.length; i++) {
    vector[i] = Number((vector[i] / norm).toFixed(5))
  }

  return vector
}

/**
 * Computes cosine similarity between two unit vectors (0.0 to 1.0)
 */
export function cosineSimilarity(vecA: VisualVector, vecB: VisualVector): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0
  let dot = 0
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i]
  }
  return Math.max(0, Math.min(1, dot))
}

/**
 * Compares query vector with articles catalog and returns top matches
 */
export function findTopMatches(
  queryVector: VisualVector,
  catalog: Array<{ article: any; signature: VisualVector }>,
  maxResults = 5
): MatchCandidate[] {
  const scored = catalog
    .map((item) => {
      const sim = cosineSimilarity(queryVector, item.signature)
      return {
        article: {
          id: item.article.id,
          code: item.article.code,
          designation: item.article.designation,
          prix_vente: item.article.prix_vente,
          image_url: item.article.image_url,
          code_barre: item.article.code_barre,
          stock_actuel: item.article.stock_actuel,
        },
        similarity: sim,
        percentage: Math.round(sim * 100),
        isHighConfidence: sim >= 0.85,
      }
    })
    .sort((a, b) => b.similarity - a.similarity)

  return scored.slice(0, maxResults)
}
