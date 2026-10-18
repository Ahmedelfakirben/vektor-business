"use client"

export function LoadingScreen() {
  return (
    <div className="flex h-[80vh] w-full items-center justify-center bg-transparent">
      <div className="flex flex-col items-center gap-5">
        <div className="relative flex h-24 w-24 items-center justify-center">
          {/* Anillo exterior palpitante naranja */}
          <div className="absolute inset-0 animate-ping rounded-3xl ring-4 ring-orange-500/20" />
          
          {/* Rueda giratoria luminosa en naranja y ámbar */}
          <div className="absolute -inset-1.5 animate-spin rounded-3xl border-2 border-orange-500/80 border-t-transparent border-r-transparent opacity-90 shadow-[0_0_20px_rgba(249,115,22,0.4)]" />
          
          {/* Logo central con el isotipo oficial Linventory (código de barras naranja) */}
          <div className="h-16 w-16 overflow-hidden rounded-2xl shadow-xl relative z-10 bg-slate-950 border border-orange-500/40 p-1 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpeg" alt="Linventory" className="h-full w-full object-cover rounded-xl" />
          </div>
        </div>
        
        {/* Marca y texto elegante */}
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="font-black text-sm tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-500">
            LINVENTORY
          </p>
          <p className="animate-pulse text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
            Chargement...
          </p>
        </div>
      </div>
    </div>
  )
}
