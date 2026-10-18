import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { AppHeader } from "@/components/layout/app-header"
import { FiscalModeProvider } from "@/providers/fiscal-mode-context"

import { Suspense } from "react"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense fallback={null}>
      <FiscalModeProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset className="min-w-0 max-w-full overflow-x-hidden">
            <AppHeader />
            <div className="flex-1 p-4 md:p-6 min-w-0 max-w-full">{children}</div>
          </SidebarInset>
        </SidebarProvider>
      </FiscalModeProvider>
    </Suspense>
  )
}
