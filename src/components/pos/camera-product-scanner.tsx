"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Camera,
  RefreshCw,
  AlertCircle,
  Upload,
  SwitchCamera,
  Package,
  ExternalLink,
  CheckCircle2,
  ChevronRight,
  Eye,
} from "lucide-react"
import { toast } from "sonner"
import type { Article } from "@/types/database"

interface CameraProductScannerProps {
  isOpen: boolean
  onClose: () => void
  onProductDetected: (article: Article) => void
}

interface ScanResult {
  matched: boolean
  match: Article | null
  confidence: number
  detected_name?: string
  reasoning?: string
  candidates?: Article[]
}

export function CameraProductScanner({
  isOpen,
  onClose,
  onProductDetected,
}: CameraProductScannerProps) {
  const [hasCamera, setHasCamera] = useState<boolean>(true)
  const [cameraLoading, setCameraLoading] = useState<boolean>(false)
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment")
  const [stream, setStream] = useState<MediaStream | null>(null)

  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false)
  const [result, setResult] = useState<ScanResult | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Start / Stop Camera stream
  const startCamera = useCallback(async () => {
    try {
      setCameraLoading(true)
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setHasCamera(false)
        return
      }

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })

      setStream(newStream)
      setHasCamera(true)

      if (videoRef.current) {
        videoRef.current.srcObject = newStream
        await videoRef.current.play().catch(() => {})
      }
    } catch (err: any) {
      console.warn("Could not start camera:", err)
      setHasCamera(false)
    } finally {
      setCameraLoading(false)
    }
  }, [facingMode, stream])

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [stream])

  // Lifecycle when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setCapturedImage(null)
      setResult(null)
      startCamera()
    } else {
      stopCamera()
    }
    return () => {
      stopCamera()
    }
  }, [isOpen])

  // Toggle Front / Back camera
  const toggleCamera = () => {
    const nextMode = facingMode === "environment" ? "user" : "environment"
    setFacingMode(nextMode)
    stopCamera()
    setTimeout(() => {
      startCamera()
    }, 100)
  }

  // Capture from live video stream
  const capturePhoto = () => {
    if (!videoRef.current) return

    const video = videoRef.current
    const canvas = document.createElement("canvas")
    const maxDim = 800
    let width = video.videoWidth || 640
    let height = video.videoHeight || 480

    if (width > maxDim || height > maxDim) {
      if (width > height) {
        height = Math.round((height * maxDim) / width)
        width = maxDim
      } else {
        width = Math.round((width * maxDim) / height)
        height = maxDim
      }
    }

    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.drawImage(video, 0, 0, width, height)
    const base64 = canvas.toDataURL("image/jpeg", 0.85)

    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([40])
    }

    stopCamera()
    setCapturedImage(base64)
    analyzeImage(base64)
  }

  // File Upload fallback
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result as string
      stopCamera()
      setCapturedImage(base64)
      analyzeImage(base64)
    }
    reader.readAsDataURL(file)
  }

  // Call Local Visual Matching API (Deterministic, zero external AI)
  const analyzeImage = async (imageBase64: string) => {
    setIsAnalyzing(true)
    setResult(null)

    try {
      const res = await fetch("/api/pos/identify-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: imageBase64,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || "Erreur lors de l'analyse de l'image")
      }

      setResult(data)

      if (data.matched && data.match) {
        toast.success(`🎯 Identifié : ${data.match.designation} (${data.confidence}%)`)
      } else if (data.candidates && data.candidates.length > 0) {
        toast.info("Articles similaires trouvés dans le catalogue")
      } else {
        toast.info("Aucun article correspondant dans l'inventaire")
      }
    } catch (err: any) {
      console.error("Analysis error:", err)
      toast.error(err.message || "Erreur lors de la reconnaissance de l'article")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleRetake = () => {
    setCapturedImage(null)
    setResult(null)
    startCamera()
  }

  const handleSelectProduct = (article: Article) => {
    onProductDetected(article)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md sm:max-w-2xl lg:max-w-3xl p-0 overflow-hidden rounded-3xl border-border/80 shadow-2xl flex flex-col max-h-[90vh]">
        <DialogHeader className="p-4 sm:px-6 sm:py-3.5 border-b bg-muted/20 shrink-0">
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center font-bold">
                <Camera className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="font-black text-base sm:text-lg tracking-tight">
                  Reconnaissance Visuelle Produit
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {capturedImage 
                    ? "Résultats de l'identification visuelle dans l'inventaire" 
                    : "Prenez en photo un produit ou importez une image pour l'ajouter au ticket"}
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Main View Area with inner scroll */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {!capturedImage ? (
            <div className="space-y-4 max-w-lg mx-auto">
              <div className="relative aspect-4/3 max-h-[380px] w-full rounded-2xl overflow-hidden bg-black flex items-center justify-center border shadow-inner">
                {hasCamera ? (
                  <>
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      autoPlay
                      className="w-full h-full object-cover"
                    />

                    {/* Viewfinder Target Overlays */}
                    <div className="absolute inset-5 pointer-events-none border-2 border-dashed border-white/50 rounded-2xl flex flex-col items-center justify-between p-3">
                      <div className="w-full flex justify-between">
                        <div className="w-4 h-4 border-t-2 border-l-2 border-orange-500" />
                        <div className="w-4 h-4 border-t-2 border-r-2 border-orange-500" />
                      </div>
                      <Badge variant="secondary" className="bg-black/70 text-white backdrop-blur-md text-[11px] font-medium border-none shadow-sm px-3 py-1">
                        Cadrez le produit ou son emballage
                      </Badge>
                      <div className="w-full flex justify-between">
                        <div className="w-4 h-4 border-b-2 border-l-2 border-orange-500" />
                        <div className="w-4 h-4 border-b-2 border-r-2 border-orange-500" />
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      onClick={toggleCamera}
                      className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/60 text-white hover:bg-black/80 backdrop-blur-xs border border-white/20"
                      title="Changer de caméra"
                    >
                      <SwitchCamera className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                    <Camera className="h-10 w-10 mb-2 opacity-40 text-white" />
                    <p className="font-semibold text-sm text-white">Caméra non disponible</p>
                    <p className="text-xs text-white/70 mt-1 max-w-xs">
                      Autorisez l&apos;accès à votre caméra ou importez une photo depuis votre appareil.
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 h-12 rounded-xl text-xs font-semibold gap-1.5 cursor-pointer"
                >
                  <Upload className="h-4 w-4" />
                  <span>Importer Image</span>
                </Button>

                <Button
                  type="button"
                  disabled={!hasCamera || cameraLoading}
                  onClick={capturePhoto}
                  className="flex-2 h-12 rounded-xl text-sm font-black gap-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-lg shadow-orange-500/25 cursor-pointer"
                >
                  <Camera className="h-5 w-5" />
                  <span>Prendre la Photo</span>
                </Button>
              </div>
            </div>
          ) : (
            /* Results View: 2-column layout on tablet/desktop */
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
              {/* Left Column: Photo Preview & Retake Button */}
              <div className="md:col-span-5 flex flex-col gap-3">
                <div className="relative aspect-square max-h-[260px] md:max-h-none w-full rounded-2xl overflow-hidden bg-slate-950 border shadow-md flex items-center justify-center">
                  <img
                    src={capturedImage}
                    alt="Capture produit"
                    className="w-full h-full object-contain bg-slate-950"
                  />

                  {isAnalyzing && (
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-2 p-4 text-center animate-in fade-in">
                      <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
                      <p className="font-bold text-xs tracking-tight">Recherche visuelle en cours...</p>
                      <p className="text-[10px] text-white/70">Comparaison avec le catalogue d&apos;articles</p>
                    </div>
                  )}

                  <Badge className="absolute top-2 left-2 bg-black/75 backdrop-blur-xs text-[10px] font-semibold text-white border-0">
                    Photo capturée
                  </Badge>
                </div>

                {/* Retake and Cancel buttons */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRetake}
                    className="flex-1 h-9 rounded-xl text-xs font-semibold gap-1.5 cursor-pointer hover:bg-muted"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-orange-500" />
                    <span>Reprendre</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onClose}
                    className="h-9 px-3 rounded-xl text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Fermer
                  </Button>
                </div>
              </div>

              {/* Right Column: Identification Result & Candidates */}
              <div className="md:col-span-7 space-y-3.5">
                {isAnalyzing ? (
                  <div className="p-6 rounded-2xl border bg-muted/20 flex flex-col items-center justify-center text-center space-y-2 min-h-[180px]">
                    <RefreshCw className="h-7 w-7 animate-spin text-orange-500" />
                    <p className="font-bold text-sm text-foreground">Analyse du produit en cours...</p>
                    <p className="text-xs text-muted-foreground max-w-xs">
                      Recherche dans vos articles enregistrés et calcul des pourcentages de similarité.
                    </p>
                  </div>
                ) : result ? (
                  <>
                    {/* Top Match with Catalog Photo Visual Comparison */}
                    {result.matched && result.match ? (
                      <div className="p-4 rounded-2xl border-2 border-emerald-500/50 bg-emerald-500/10 dark:bg-emerald-950/20 space-y-3.5 shadow-sm">
                        <div className="flex items-start gap-3.5">
                          {/* Catalog Photo of Matched Article */}
                          <div className="relative h-18 w-18 sm:h-20 sm:w-20 rounded-2xl overflow-hidden border-2 border-emerald-500/60 shadow-md bg-white dark:bg-slate-900 shrink-0 flex items-center justify-center">
                            {result.match.image_url ? (
                              <img
                                src={result.match.image_url}
                                alt={result.match.designation}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="flex flex-col items-center justify-center text-emerald-600 dark:text-emerald-400 p-2 text-center">
                                <Package className="h-7 w-7 opacity-75" />
                                <span className="text-[8px] font-semibold text-muted-foreground mt-0.5 leading-tight">Sans photo</span>
                              </div>
                            )}
                            <div className="absolute top-1 right-1 bg-emerald-600 text-white rounded-full p-0.5 shadow-xs">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </div>
                            <div className="absolute bottom-0 inset-x-0 bg-black/65 text-white text-[8px] font-bold text-center py-0.5 tracking-wider uppercase">
                              Catalogue
                            </div>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-black text-sm sm:text-base text-foreground leading-snug">
                                {result.match.designation}
                              </span>
                              <Badge variant="outline" className="text-[10px] font-bold border-emerald-500/60 text-emerald-600 dark:text-emerald-400 bg-emerald-500/15">
                                {result.confidence}% similitude
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Réf: <span className="font-mono text-foreground font-semibold">{result.match.code}</span>
                              {result.match.code_barre && (
                                <span> • CB: <span className="font-mono">{result.match.code_barre}</span></span>
                              )}
                            </p>
                            <p className="text-sm font-black text-foreground mt-0.5">
                              Prix : <span className="text-emerald-600 dark:text-emerald-400 text-base">{Number(result.match.prix_vente).toFixed(2)} MAD</span>
                            </p>
                          </div>
                        </div>

                        {result.reasoning && (
                          <p className="text-[11px] text-muted-foreground bg-background/80 p-2.5 rounded-xl border border-border/40 leading-relaxed">
                            💡 <span className="font-semibold text-foreground">Validation visuelle :</span> {result.reasoning}
                          </p>
                        )}

                        <Button
                          size="lg"
                          onClick={() => handleSelectProduct(result.match!)}
                          className="w-full h-11 rounded-xl text-xs sm:text-sm font-black gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/25 cursor-pointer transition-transform active:scale-[0.99]"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Ajouter au Ticket ({Number(result.match.prix_vente).toFixed(2)} MAD)</span>
                        </Button>
                      </div>
                    ) : (
                      <div className="p-4 rounded-2xl border border-amber-500/40 bg-amber-500/5 text-center space-y-3">
                        <AlertCircle className="h-8 w-8 mx-auto text-amber-500" />
                        <div>
                          <p className="font-bold text-sm text-foreground">
                            {result.detected_name ? `Meilleure ressemblance : "${result.detected_name}" (${result.confidence}%)` : "Produit non reconnu"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Aucune correspondance exacte trouvée dans le catalogue d&apos;articles.
                          </p>
                        </div>
                        <Button
                          type="button"
                          onClick={() => {
                            if (capturedImage) {
                              try {
                                sessionStorage.setItem("ai_product_prefill_image", capturedImage)
                              } catch {}
                            }
                            window.open("/articles/nouveau", "_blank")
                          }}
                          className="w-full h-10 rounded-xl text-xs font-bold gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md cursor-pointer"
                        >
                          <Package className="h-4 w-4" />
                          <span>Créer un nouvel article avec cette photo</span>
                          <ExternalLink className="h-3.5 w-3.5 ml-auto opacity-70" />
                        </Button>
                      </div>
                    )}

                    {/* Alternative Candidates */}
                    {result.candidates && result.candidates.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                          Articles les plus proches visuellement
                        </span>
                        <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                          {result.candidates.map((cand: any) => (
                            <div
                              key={cand.id}
                              onClick={() => handleSelectProduct(cand)}
                              className="p-2.5 rounded-xl border bg-card hover:bg-accent/50 hover:border-orange-500/40 transition-all flex items-center justify-between cursor-pointer group"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                {cand.image_url ? (
                                  <img
                                    src={cand.image_url}
                                    alt={cand.designation}
                                    className="h-10 w-10 rounded-lg object-cover border shrink-0"
                                  />
                                ) : (
                                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0 border">
                                    <Package className="h-4 w-4 text-muted-foreground group-hover:text-orange-500" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="font-bold text-xs text-foreground group-hover:text-orange-500 truncate">
                                    {cand.designation}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground">
                                    <span className="font-mono">{cand.code}</span> • <span className="font-bold text-foreground">{Number(cand.prix_vente).toFixed(2)} MAD</span>
                                    {cand.similarity_percentage && ` • ${cand.similarity_percentage}% semblable`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0 ml-2">
                                <span className="text-[10px] font-semibold text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hidden sm:inline">
                                  Choisir
                                </span>
                                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-orange-500 group-hover:translate-x-0.5 transition-transform" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
