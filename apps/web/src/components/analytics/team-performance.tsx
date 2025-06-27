'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  Trophy,
  Mail,
  MessageSquare,
  Clock,
  Target,
  Star
} from 'lucide-react'
import { DateRange } from 'react-day-picker'

interface TeamPerformanceProps {
  workspaceId?: string
  dateRange?: DateRange
}

export function TeamPerformance({ workspaceId, dateRange }: TeamPerformanceProps) {
  const supabase = createClient()

  const { data: teamData, isLoading } = useQuery({
    queryKey: ['team-performance', workspaceId, dateRange],
    queryFn: async () => {
      if (!workspaceId) return []

      const { data, error } = await supabase
        .rpc('get_team_performance_metrics', {
          p_workspace_id: workspaceId,
          p_start_date: dateRange?.from?.toISOString(),
          p_end_date: dateRange?.to?.toISOString(),
        })

      if (error) throw error
      
      // Sort by performance score
      return data.sort((a: any, b: any) => b.performance_score - a.performance_score)
    },
    enabled: !!workspaceId,
  })

  const getPerformanceBadge = (score: number) => {
    if (score >= 90) return { text: 'Outstanding', color: 'bg-green-100 text-green-800' }
    if (score >= 75) return { text: 'Excellent', color: 'bg-blue-100 text-blue-800' }
    if (score >= 60) return { text: 'Good', color: 'bg-yellow-100 text-yellow-800' }
    return { text: 'Needs Improvement', color: 'bg-red-100 text-red-800' }
  }

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }
    return email?.slice(0, 2).toUpperCase() || '??'
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <div className="animate-pulse text-muted-foreground">
            Loading team performance data...
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Top Performers */}
      <div className="grid gap-4 md:grid-cols-3">
        {teamData?.slice(0, 3).map((member: any, index: number) => (
          <Card key={member.user_id} className={index === 0 ? 'border-yellow-500' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${member.email}`} />
                    <AvatarFallback>
                      {getInitials(member.name, member.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-base">
                      {member.name || member.email}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {member.role}
                    </CardDescription>
                  </div>
                </div>
                {index === 0 && <Trophy className="h-5 w-5 text-yellow-500" />}
                {index === 1 && <Trophy className="h-5 w-5 text-gray-400" />}
                {index === 2 && <Trophy className="h-5 w-5 text-amber-600" />}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Performance Score</span>
                  <span className="font-semibold">{member.performance_score}/100</span>
                </div>
                <Progress value={member.performance_score} className="h-2" />
                <Badge className={getPerformanceBadge(member.performance_score).color}>
                  {getPerformanceBadge(member.performance_score).text}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detailed Metrics Table */}
      <Card>
        <CardHeader>
          <CardTitle>Team Performance Details</CardTitle>
          <CardDescription>
            Individual performance metrics for all team members
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team Member</TableHead>
                <TableHead className="text-center">Emails Sent</TableHead>
                <TableHead className="text-center">Reply Rate</TableHead>
                <TableHead className="text-center">Avg Response Time</TableHead>
                <TableHead className="text-center">Conversations</TableHead>
                <TableHead className="text-center">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamData?.map((member: any) => (
                <TableRow key={member.user_id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${member.email}`} />
                        <AvatarFallback>
                          {getInitials(member.name, member.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{member.name || member.email}</p>
                        <p className="text-sm text-muted-foreground">{member.role}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      {member.emails_sent}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      {member.reply_rate}%
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {member.avg_response_time}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Target className="h-4 w-4 text-muted-foreground" />
                      {member.conversations_handled}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className="font-semibold">{member.performance_score}</span>
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 ${
                              i < Math.floor(member.performance_score / 20)
                                ? 'text-yellow-500 fill-yellow-500'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}