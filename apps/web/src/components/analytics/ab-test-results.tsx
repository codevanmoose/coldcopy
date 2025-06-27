'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer
} from 'recharts'
import { 
  Beaker,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  CheckCircle2
} from 'lucide-react'
import { DateRange } from 'react-day-picker'

interface ABTestResultsProps {
  workspaceId?: string
  dateRange?: DateRange
}

export function ABTestResults({ workspaceId, dateRange }: ABTestResultsProps) {
  const supabase = createClient()

  const { data: abTests, isLoading } = useQuery({
    queryKey: ['ab-tests', workspaceId, dateRange],
    queryFn: async () => {
      if (!workspaceId) return []

      const { data, error } = await supabase
        .rpc('get_ab_test_results', {
          p_workspace_id: workspaceId,
          p_start_date: dateRange?.from?.toISOString(),
          p_end_date: dateRange?.to?.toISOString(),
        })

      if (error) throw error
      return data
    },
    enabled: !!workspaceId,
  })

  const getConfidenceLevel = (confidence: number) => {
    if (confidence >= 95) return { text: 'High', color: 'text-green-600' }
    if (confidence >= 80) return { text: 'Medium', color: 'text-yellow-600' }
    return { text: 'Low', color: 'text-red-600' }
  }

  const getWinnerIcon = (isWinner: boolean, isSignificant: boolean) => {
    if (!isSignificant) return <Minus className="h-4 w-4 text-gray-400" />
    if (isWinner) return <CheckCircle2 className="h-4 w-4 text-green-600" />
    return <AlertCircle className="h-4 w-4 text-red-600" />
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <div className="animate-pulse text-muted-foreground">
            Loading A/B test results...
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!abTests || abTests.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-96 gap-4">
          <Beaker className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">No A/B tests found for the selected period</p>
          <Button variant="outline">Create Your First A/B Test</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {abTests.map((test: any) => {
        const variantAData = {
          name: test.variant_a_name || 'Variant A',
          sent: test.variant_a_sent,
          openRate: test.variant_a_open_rate,
          clickRate: test.variant_a_click_rate,
          replyRate: test.variant_a_reply_rate,
        }
        
        const variantBData = {
          name: test.variant_b_name || 'Variant B',
          sent: test.variant_b_sent,
          openRate: test.variant_b_open_rate,
          clickRate: test.variant_b_click_rate,
          replyRate: test.variant_b_reply_rate,
        }

        const chartData = [
          {
            metric: 'Open Rate',
            [variantAData.name]: variantAData.openRate,
            [variantBData.name]: variantBData.openRate,
          },
          {
            metric: 'Click Rate',
            [variantAData.name]: variantAData.clickRate,
            [variantBData.name]: variantBData.clickRate,
          },
          {
            metric: 'Reply Rate',
            [variantAData.name]: variantAData.replyRate,
            [variantBData.name]: variantBData.replyRate,
          },
        ]

        return (
          <Card key={test.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{test.campaign_name}</CardTitle>
                  <CardDescription>
                    Testing: {test.test_variable} • {test.variant_a_sent + test.variant_b_sent} emails sent
                  </CardDescription>
                </div>
                <Badge 
                  variant={test.status === 'active' ? 'default' : 'secondary'}
                  className="flex items-center gap-1"
                >
                  <Beaker className="h-3 w-3" />
                  {test.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Chart */}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="metric" />
                    <YAxis />
                    <Tooltip formatter={(value) => `${value}%`} />
                    <Legend />
                    <Bar dataKey={variantAData.name} fill="#8884d8" />
                    <Bar dataKey={variantBData.name} fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Results Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Variant</TableHead>
                    <TableHead className="text-center">Sent</TableHead>
                    <TableHead className="text-center">Open Rate</TableHead>
                    <TableHead className="text-center">Click Rate</TableHead>
                    <TableHead className="text-center">Reply Rate</TableHead>
                    <TableHead className="text-center">Winner</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">{variantAData.name}</TableCell>
                    <TableCell className="text-center">{variantAData.sent}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {variantAData.openRate}%
                        {variantAData.openRate > variantBData.openRate && 
                          <TrendingUp className="h-3 w-3 text-green-600" />
                        }
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {variantAData.clickRate}%
                        {variantAData.clickRate > variantBData.clickRate && 
                          <TrendingUp className="h-3 w-3 text-green-600" />
                        }
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {variantAData.replyRate}%
                        {variantAData.replyRate > variantBData.replyRate && 
                          <TrendingUp className="h-3 w-3 text-green-600" />
                        }
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {getWinnerIcon(test.winner === 'a', test.is_significant)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">{variantBData.name}</TableCell>
                    <TableCell className="text-center">{variantBData.sent}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {variantBData.openRate}%
                        {variantBData.openRate > variantAData.openRate && 
                          <TrendingUp className="h-3 w-3 text-green-600" />
                        }
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {variantBData.clickRate}%
                        {variantBData.clickRate > variantAData.clickRate && 
                          <TrendingUp className="h-3 w-3 text-green-600" />
                        }
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {variantBData.replyRate}%
                        {variantBData.replyRate > variantAData.replyRate && 
                          <TrendingUp className="h-3 w-3 text-green-600" />
                        }
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {getWinnerIcon(test.winner === 'b', test.is_significant)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              {/* Statistical Significance */}
              <div className="flex items-center justify-between bg-muted/50 rounded-lg p-4">
                <div>
                  <p className="text-sm font-medium">Statistical Confidence</p>
                  <p className="text-xs text-muted-foreground">
                    {test.is_significant ? 'Results are statistically significant' : 'More data needed for significance'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={test.confidence_level} className="w-24 h-2" />
                  <span className={`text-sm font-medium ${getConfidenceLevel(test.confidence_level).color}`}>
                    {test.confidence_level}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}