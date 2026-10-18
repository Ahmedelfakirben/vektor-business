"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Download, Share, PlusSquare, Smartphone } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [showIOSGuide, setShowIOSGuide] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Detectar si ya está instalada
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone
    setIsStandalone(standalone)

    // Detectar iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    setIsIOS(ios)

    // Capturar evento de Android/Chrome
    const handler = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setIsVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    
    // En iOS siempre lo mostramos si no es standalone
    if (ios && !standalone) {
      setIsVisible(true)
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSGuide(true)
      return
    }

    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
      setIsVisible(false)
    }
  }

  if (isStandalone || !isVisible) return null

  return (
    <div className="mt-8 flex flex-col items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-muted-foreground/20 to-transparent" />
      
      <p className="text-xs text-muted-foreground font-medium">
        Accédez plus rapidement à l'ERP
      </p>

      <Button
        variant="outline"
        onClick={handleInstallClick}
        className="group relative h-12 w-full max-w-[280px] overflow-hidden rounded-xl border-orange-500/30 bg-orange-500/5 transition-all hover:bg-orange-500 hover:text-white"
      >
        <div className="flex items-center gap-2">
          {isIOS ? <Smartphone className="h-4 w-4" /> : <Download className="h-4 w-4 group-hover:bounce" />}
          <span className="font-bold">Installer l'application</span>
        </div>
      </Button>

      {/* Guía para iOS */}
      <Dialog open={showIOSGuide} onOpenChange={setShowIOSGuide}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-orange-600" />
              Installer sur iPhone
            </DialogTitle>
            <DialogDescription>
              Suivez ces étapes simples pour ajouter l'ERP à votre écran d'accueil :
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex items-center gap-4 rounded-xl bg-muted/50 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white font-bold">1</div>
              <p className="text-sm">Appuyez sur le bouton <strong>Partager</strong> <Share className="inline h-4 w-4 mx-1 text-blue-500" /> en bas de l'écran.</p>
            </div>
            <div className="flex items-center gap-4 rounded-xl bg-muted/50 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white font-bold">2</div>
              <p className="text-sm">Faites défiler et appuyez sur <strong>Sur l'écran d'accueil</strong> <PlusSquare className="inline h-4 w-4 mx-1" />.</p>
            </div>
          </div>
          <Button onClick={() => setShowIOSGuide(false)} className="w-full h-11 rounded-xl bg-orange-600 hover:bg-orange-700">
            J'ai compris
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
