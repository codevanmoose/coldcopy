'use client'

import { useAuthStore } from '@/stores/auth'
import { AuthProvider } from '@/components/providers/auth-provider'
import { QueryProvider } from '@/components/providers/query-provider'
import { WhiteLabelProvider } from '@/components/white-label/white-label-provider'
import { CommandPalette } from '@/components/ui/command-palette'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { TrialBanner } from '@/components/billing/trial-banner'
import { Loader2 } from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <QueryProvider>
      <AuthProvider>
        <WhiteLabelProvider>
          <DashboardContent>{children}</DashboardContent>
          <CommandPalette />
        </WhiteLabelProvider>
      </AuthProvider>
    </QueryProvider>
  )
}

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { isLoading, isHydrated } = useAuthStore()

  // Show loading while the auth store is hydrating or loading user data
  if (!isHydrated || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:pl-64">
        <Header />
        <TrialBanner className="border-b" />
        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}