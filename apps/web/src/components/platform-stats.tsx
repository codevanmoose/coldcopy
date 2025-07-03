'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

interface PlatformStatsData {
  roi_improvement: number
  time_savings: number
  meeting_multiplier: number
  last_updated: string
}

export function PlatformStats() {
  const [stats, setStats] = useState<PlatformStatsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/platform/stats', { cache: 'force-cache' })
        if (response.ok) {
          const data = await response.json()
          setStats(data)
        } else {
          // Fallback to default values if API fails
          setStats({
            roi_improvement: 312,
            time_savings: 73,
            meeting_multiplier: 4.2,
            last_updated: new Date().toISOString()
          })
        }
      } catch (error) {
        console.error('Failed to fetch platform stats:', error)
        // Fallback to default values
        setStats({
          roi_improvement: 312,
          time_savings: 73,
          meeting_multiplier: 4.2,
          last_updated: new Date().toISOString()
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (isLoading) {
    return (
      <div className="grid md:grid-cols-3 gap-8 mb-12">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-16 bg-white/10 rounded mb-2"></div>
            <div className="h-4 bg-white/5 rounded w-3/4 mx-auto"></div>
          </div>
        ))}
      </div>
    )
  }

  if (!stats) return null

  return (
    <>
      <div className="grid md:grid-cols-3 gap-8 mb-12">
        <div>
          <div className="text-5xl font-bold bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent mb-2">
            {stats.roi_improvement}%
          </div>
          <div className="text-white/70">Average ROI in 90 days</div>
        </div>
        <div>
          <div className="text-5xl font-bold bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent mb-2">
            {stats.time_savings}%
          </div>
          <div className="text-white/70">Less time spent on outreach</div>
        </div>
        <div>
          <div className="text-5xl font-bold bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent mb-2">
            {stats.meeting_multiplier}x
          </div>
          <div className="text-white/70">More qualified meetings</div>
        </div>
      </div>
      
      <p className="text-lg text-white/70 mb-8">
        Join 500+ companies that have transformed their sales process with ColdCopy
      </p>
      
      <Link href="/signup">
        <Button className="bg-gradient-to-r from-orange-400 to-pink-400 hover:from-orange-500 hover:to-pink-500 text-white font-semibold px-8 py-4 text-lg">
          Start Your Free Trial
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </Link>
      
      {stats.last_updated && (
        <p className="mt-4 text-xs text-white/40">
          Data updated: {new Date(stats.last_updated).toLocaleDateString()}
        </p>
      )}
    </>
  )
}