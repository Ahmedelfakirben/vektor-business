"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client"
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister"
import { useState, useEffect } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes cache
            gcTime: 1000 * 60 * 60 * 24, // 24 hours persistence
            retry: 1,
          },
        },
      })
  )

  const [persister] = useState<any>(() => {
    if (typeof window !== "undefined") {
      try {
        return createSyncStoragePersister({
          storage: window.localStorage,
        })
      } catch (e) {
        console.warn("Could not create storage persister:", e)
      }
    }
    return null
  })

  if (!persister) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          {children}
          <Toaster position="top-right" richColors />
        </TooltipProvider>
      </QueryClientProvider>
    )
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ 
        persister,
        maxAge: 1000 * 60 * 60 * 24, // Keep for 24h
      }}
    >
      <TooltipProvider>
        {children}
        <Toaster position="top-right" richColors />
      </TooltipProvider>
    </PersistQueryClientProvider>
  )
}
