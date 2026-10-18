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
import { Camera, SwitchCamera, RefreshCw, CheckCircle2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"

interface ArticleCameraModalProps {
  isOpen: boolean
  onClose: () => void
  onPhotoCaptured: (imageUrl: string) => void
}

export function ArticleCameraModal({
  isOpen,
  onClose,
  onPhotoCaptured,
}: ArticleCameraModalProps) {
  const [hasCamera, setHasCamera] = useState<boolean>(true)
  const [cameraLoading, setCameraLoading] = useState<boolean>(false)
  const [isUploading, setIsUploading] = useState<boolean>(false)
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment")
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)

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

  useEffect(() => {
    if (isOpen) {
      setCapturedImage(null)
      startCamera()
    } else {
      stopCamera()
    }
    return () => {
      stopCamera()
    }
  }, [isOpen])

  const toggleCamera = () => {
    const nextMode = facingMode === "environment" ? "user" : "environment"
    setFacingMode(nextMode)
    stopCamera()
    setTimeout(() => {
      startCamera()
    }, 100)
  }

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
    const base64 = canvas.toDataURL("image/jpeg", 0.9)

    stopCamera()
    setCapturedImage(base64)
  }

  const handleConfirmPhoto = async () => {
    if (!capturedImage) return

    setIsUploading(true)
    try {
      const supabase = createClient()
      const fileName = `article-${Date.now()}-${Math.random().toString(36).substring(2)}.jpeg`

      // Convert base64 to Blob
      const res = await fetch(capturedImage)
      const blob = await res.blob()

      const { data, error } = await supabase.storage
        .from("articles")
        .upload(fileName, blob, {
          contentType: "image/jpeg",
          upsert: true,
        })

      if (error) throw error

      const { data: publicData } = supabase.storage
        .from("articles")
        .getPublicUrl(fileName)

      const imageUrl = publicData.publicUrl

      // Register visual signature in background
      try {
        await fetch("/api/articles/signature", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: imageUrl }),
        })
      } catch (sigErr) {
        console.warn("Could not compute visual signature:", sigErr)
      }

      toast.success("Photo enregistrée avec succès")
      onPhotoCaptured(imageUrl)
      onClose()
    } catch (err: any) {
      console.error("Upload error:", err)
      toast.error(err.message || "Erreur lors de l'enregistrement de la photo")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md sm:max-w-lg p-0 overflow-hidden rounded-3xl border-border/80 shadow-2xl">
        <DialogHeader className="p-4 sm:p-5 border-b bg-muted/20">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="font-black text-base sm:text-lg tracking-tight">
                Photo du Produit
              </DialogTitle>
              <DialogDescription className="text-xs">
                Prenez une photo claire du produit pour l&apos;enregistrer dans le catalogue
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 sm:p-5 space-y-4">
          {!capturedImage ? (
            <div className="space-y-4">
              <div className="relative aspect-4/3 w-full rounded-2xl overflow-hidden bg-black flex items-center justify-center border shadow-inner">
                {hasCamera ? (
                  <>
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      autoPlay
                      className="w-full h-full object-cover"
                    />

                    <div className="absolute inset-6 pointer-events-none border-2 border-dashed border-white/50 rounded-2xl flex flex-col items-center justify-between p-3">
                      <div className="w-full flex justify-between">
                        <div className="w-4 h-4 border-t-2 border-l-2 border-primary" />
                        <div className="w-4 h-4 border-t-2 border-r-2 border-primary" />
                      </div>
                      <Badge variant="secondary" className="bg-black/60 text-white backdrop-blur-md text-[11px] font-medium border-none shadow-sm">
                        Cadrez bien le produit
                      </Badge>
                      <div className="w-full flex justify-between">
                        <div className="w-4 h-4 border-b-2 border-l-2 border-primary" />
                        <div className="w-4 h-4 border-b-2 border-r-2 border-primary" />
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
                  </div>
                )}
              </div>

              <Button
                type="button"
                disabled={!hasCamera || cameraLoading}
                onClick={capturePhoto}
                className="w-full h-12 rounded-xl text-sm font-black gap-2 shadow-lg shadow-primary/25 cursor-pointer"
              >
                <Camera className="h-5 w-5" />
                <span>Prendre la Photo</span>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative aspect-4/3 w-full rounded-2xl overflow-hidden bg-black flex items-center justify-center border shadow-xs">
                <img
                  src={capturedImage}
                  alt="Aperçu photo produit"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCapturedImage(null)
                    startCamera()
                  }}
                  disabled={isUploading}
                  className="flex-1 h-11 rounded-xl text-xs font-semibold gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Reprendre</span>
                </Button>

                <Button
                  type="button"
                  onClick={handleConfirmPhoto}
                  disabled={isUploading}
                  className="flex-2 h-11 rounded-xl text-xs font-black gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  <span>Confirmer cette photo</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
