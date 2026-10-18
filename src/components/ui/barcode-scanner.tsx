"use client"

import { useEffect, useRef, useState } from "react"
import type { Html5Qrcode } from "html5-qrcode"
import { Button } from "@/components/ui/button"
import { X, Camera, RefreshCw } from "lucide-react"
import { toast } from "sonner"

interface BarcodeScannerProps {
  onScan: (decodedText: string) => void
  onClose: () => void
  title?: string
}

export function BarcodeScanner({ onScan, onClose, title = "Scanner un código" }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [hasCamera, setHasCamera] = useState(true)

  useEffect(() => {
    const scannerId = "reader"
    
    const startScanner = async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode")
        const cameras = await Html5Qrcode.getCameras()
        if (cameras && cameras.length > 0) {
          const scanner = new Html5Qrcode(scannerId, {
              formatsToSupport: [
                Html5QrcodeSupportedFormats.QR_CODE,
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.CODE_39,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E,
              ],
              verbose: false
          })
          scannerRef.current = scanner
          
          await scanner.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: { width: 250, height: 150 },
            },
            (decodedText) => {
              onScan(decodedText)
              stopScanner()
              onClose()
            },
            () => {
              // Ignore failure for scanning frames
            }
          )
          setIsReady(true)
        } else {
          setHasCamera(false)
          toast.error("Aucune caméra trouvée")
        }
      } catch (err) {
        console.error("Scanner Error:", err)
        setHasCamera(false)
        toast.error("Erreur d'accès à la caméra")
      }
    }

    startScanner()

    return () => {
      stopScanner()
    }
  }, [])

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop()
        scannerRef.current = null
      } catch (err) {
        console.error("Stop Scanner Error:", err)
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg bg-background rounded-2xl overflow-hidden shadow-2xl border border-border">
        <div className="p-4 border-b flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-600">
              <Camera className="h-4 w-4" />
            </div>
            <h3 className="font-semibold">{title}</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={() => { stopScanner(); onClose(); }} className="rounded-full">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="relative aspect-[4/3] bg-black">
          <div id="reader" className="w-full h-full overflow-hidden" />
          {!isReady && hasCamera && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 bg-black/40">
              <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
              <p className="text-sm font-medium">Initialisation de la caméra...</p>
            </div>
          )}
          {!hasCamera && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-4 p-8 text-center">
              <div className="p-4 rounded-full bg-destructive/20 text-destructive">
                <X className="h-10 w-10" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-lg">Caméra inaccessible</p>
                <p className="text-sm text-gray-400">Veuillez autoriser l&apos;accès à la caméra ou vérifier qu&apos;elle n&apos;est pas utilisée par une otra aplicación.</p>
              </div>
              <Button variant="outline" onClick={onClose} className="text-white border-white/20 hover:bg-white/10">Fermer</Button>
            </div>
          )}
          
          {isReady && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 border-[40px] border-black/50" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-32 border-2 border-orange-500 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]">
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-orange-500 rounded-tl" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-orange-500 rounded-tr" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-orange-500 rounded-bl" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-orange-500 rounded-br" />
                
                {/* Scanning line animation */}
                <div className="absolute top-0 left-0 w-full h-0.5 bg-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.8)] animate-scan-line" />
              </div>
            </div>
          )}
        </div>

        <div className="p-6 text-center bg-muted/10">
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
            Placer el código (QR o Barras) dentro del marco para escanear
          </p>
        </div>
      </div>
      
      <style jsx global>{`
        @keyframes scan-line {
          0% { top: 0%; opacity: 0.1; }
          50% { opacity: 1; }
          100% { top: 100%; opacity: 0.1; }
        }
        .animate-scan-line {
          animation: scan-line 2s ease-in-out infinite;
        }
        #reader__dashboard { display: none !important; }
        #reader video { 
          object-fit: cover !important; 
          width: 100% !important; 
          height: 100% !important; 
        }
      `}</style>
    </div>
  )
}
