"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"

type FiscalModeContextType = {
  fiscalMode: boolean
  toggleFiscalMode: () => void
}

const FiscalModeContext = createContext<FiscalModeContextType | undefined>(undefined)

export function FiscalModeProvider({ children }: { children: React.ReactNode }) {
  const [fiscalMode, setFiscalMode] = useState<boolean>(false)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Ensure unified standard mode
  useEffect(() => {
    localStorage.removeItem("fiscal_mode")
    document.documentElement.classList.remove("fiscal-mode")
  }, [])

  // Sync URL for Server Components (like Dashboard)
  const toggleFiscalMode = () => {
    setFiscalMode((prev) => {
      const next = !prev
      localStorage.setItem("fiscal_mode", String(next))
      
      if (next) {
        document.documentElement.classList.add("fiscal-mode")
      } else {
        document.documentElement.classList.remove("fiscal-mode")
      }

      // Update URL if on Dashboard to trigger server re-fetch
      if (pathname === "/dashboard") {
        const params = new URLSearchParams(searchParams.toString())
        if (next) params.set("mode", "fiscal")
        else params.delete("mode")
        router.push(`${pathname}?${params.toString()}`)
      }

      return next
    })
  }

  return (
    <FiscalModeContext.Provider value={{ fiscalMode, toggleFiscalMode }}>
      {children}
    </FiscalModeContext.Provider>
  )
}

export function useFiscalMode() {
  const context = useContext(FiscalModeContext)
  if (context === undefined) {
    throw new Error("useFiscalMode must be used within a FiscalModeProvider")
  }
  return context
}
