'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { DateRange } from 'react-day-picker'
import { Clock, TrendingDown } from 'lucide-react'

interface ResponseTimeChartProps {
  workspaceId?: string
  dateRange?: DateRange
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

export function ResponseTimeChart({ workspaceId, dateRange }: ResponseTimeChartProps) {
  const supabase = createClient()

  const { data: responseData, isLoading } = useQuery({
    queryKey: ['response-times', workspaceId, dateRange],
    queryFn: async () => {
      if (!workspaceId) return null

      const { data, error } = await supabase
        .rpc('get_response_time_analytics', {
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
            Loading response time data...
          </div>
        </CardContent>
      </Card>
    )
  }

  const distributionData = [
    { name: '< 1 hour', value: responseData?.under_1_hour || 0 },
    { name: '1-4 hours', value: responseData?.under_4_hours || 0 },
    { name: '4-24 hours', value: responseData?.under_24_hours || 0 },
    { name: '1-3 days', value: responseData?.under_3_days || 0 },
    { name: '> 3 days', value: responseData?.over_3_days || 0 },
  ]

  const hourlyData = responseData?.hourly_distribution || []

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Response Time Distribution
          </CardTitle>
          <CardDescription>
            How quickly leads receive responses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={distributionData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {distributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Average Response Time</span>
              <span className="font-semibold">{responseData?.avg_response_time || '0h'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Median Response Time</span>
              <span className="font-semibold">{responseData?.median_response_time || '0h'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Improvement from Last Period</span>
              <span className="font-semibold flex items-center gap-1 text-green-600">
                <TrendingDown className="h-4 w-4" />
                {responseData?.improvement_percentage || 0}%
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Response Times by Hour</CardTitle>
          <CardDescription>
            Best times for quick responses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={hourlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip formatter={(value) => `${value} min`} />
              <Legend />
              <Bar 
                dataKey="avg_response_minutes" 
                fill="#8884d8" 
                name="Avg Response Time (min)"
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}