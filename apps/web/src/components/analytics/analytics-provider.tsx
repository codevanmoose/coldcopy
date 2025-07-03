'use client'

import { useEffect, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { pageview } from '@/lib/analytics/gtag'

function AnalyticsProviderInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '')
    pageview(url)
  }, [pathname, searchParams])

  return null
}

export function AnalyticsProvider() {
  return (
    <Suspense fallback={null}>
      <AnalyticsProviderInner />
    </Suspense>
  )
}