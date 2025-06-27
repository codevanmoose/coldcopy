'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { DateRange } from 'react-day-picker'
import { 
  Users, 
  Mail, 
  MousePointer, 
  MessageSquare,
  Target,
  TrendingUp
} from 'lucide-react'

interface LeadConversionFunnelProps {
  workspaceId?: string
  dateRange?: DateRange
}

export function LeadConversionFunnel({ workspaceId, dateRange }: LeadConversionFunnelProps) {
  const supabase = createClient()

  const { data: funnelData, isLoading } = useQuery({
    queryKey: ['lead-funnel', workspaceId, dateRange],
    queryFn: async () => {
      if (!workspaceId) return null

      const { data, error } = await supabase
        .rpc('get_lead_conversion_funnel', {
          p_workspace_id: workspaceId,
          p_start_date: dateRange?.from?.toISOString(),
          p_end_date: dateRange?.to?.toISOString(),
        })

      if (error) throw error
      return data
    },
    enabled: !!workspaceId,
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <div className="animate-pulse text-muted-foreground">
            Loading conversion data...
          </div>
        </CardContent>
      </Card>
    )
  }

  const stages = [
    {
      name: 'Total Leads',
      value: funnelData?.total_leads || 0,
      icon: Users,
      color: 'bg-blue-500',
      percentage: 100,
    },
    {
      name: 'Emails Sent',
      value: funnelData?.emails_sent || 0,
      icon: Mail,
      color: 'bg-indigo-500',
      percentage: funnelData?.total_leads > 0 
        ? ((funnelData?.emails_sent || 0) / funnelData.total_leads * 100) 
        : 0,
    },
    {
      name: 'Emails Opened',
      value: funnelData?.emails_opened || 0,
      icon: Mail,
      color: 'bg-purple-500',
      percentage: funnelData?.emails_sent > 0 
        ? ((funnelData?.emails_opened || 0) / funnelData.emails_sent * 100) 
        : 0,
    },
    {
      name: 'Links Clicked',
      value: funnelData?.emails_clicked || 0,
      icon: MousePointer,
      color: 'bg-pink-500',
      percentage: funnelData?.emails_opened > 0 
        ? ((funnelData?.emails_clicked || 0) / funnelData.emails_opened * 100) 
        : 0,
    },
    {
      name: 'Replied',
      value: funnelData?.emails_replied || 0,
      icon: MessageSquare,
      color: 'bg-orange-500',
      percentage: funnelData?.emails_sent > 0 
        ? ((funnelData?.emails_replied || 0) / funnelData.emails_sent * 100) 
        : 0,
    },
    {
      name: 'Converted',
      value: funnelData?.leads_converted || 0,
      icon: Target,
      color: 'bg-green-500',
      percentage: funnelData?.emails_replied > 0 
        ? ((funnelData?.leads_converted || 0) / funnelData.emails_replied * 100) 
        : 0,
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lead Conversion Funnel</CardTitle>
        <CardDescription>
          Track how leads progress through your outreach funnel
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {stages.map((stage, index) => {
            const Icon = stage.icon
            return (
              <div key={stage.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${stage.color} text-white`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">{stage.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {stage.value.toLocaleString()} leads
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">
                      {stage.percentage.toFixed(1)}%
                    </p>
                    {index > 0 && (
                      <p className="text-sm text-muted-foreground">
                        of previous stage
                      </p>
                    )}
                  </div>
                </div>
                <Progress value={stage.percentage} className="h-2" />
              </div>
            )
          })}

          <div className="border-t pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Overall Conversion Rate</p>
                <p className="text-2xl font-bold flex items-center gap-2">
                  {funnelData?.total_leads > 0 
                    ? ((funnelData?.leads_converted || 0) / funnelData.total_leads * 100).toFixed(2)
                    : 0}%
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Average Reply Rate</p>
                <p className="text-2xl font-bold">
                  {funnelData?.emails_sent > 0 
                    ? ((funnelData?.emails_replied || 0) / funnelData.emails_sent * 100).toFixed(2)
                    : 0}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}