'use client'

import { useState, useEffect } from 'react'
import { 
  Activity, 
  User, 
  Mail, 
  Target, 
  FileText, 
  Edit, 
  Plus, 
  Trash, 
  Eye,
  Clock,
  Filter,
  RefreshCw
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useActivityFeed } from './collaboration-provider'
import { ActivityItem } from '@/lib/collaboration/collaboration-service'

interface ActivityFeedProps {
  className?: string
  limit?: number
  showFilter?: boolean
  compact?: boolean
}

export function ActivityFeed({ 
  className = '', 
  limit = 20, 
  showFilter = true,
  compact = false 
}: ActivityFeedProps) {
  const { recentActivity, getActivityFeed } = useActivityFeed()
  const [filteredActivity, setFilteredActivity] = useState<ActivityItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [filter, setFilter] = useState<{
    activityType: string
    resourceType: string
    timeRange: string
  }>({
    activityType: 'all',
    resourceType: 'all',
    timeRange: 'all'
  })

  useEffect(() => {
    applyFilters()
  }, [recentActivity, filter])

  const applyFilters = () => {
    let filtered = [...recentActivity]

    // Apply activity type filter
    if (filter.activityType !== 'all') {
      filtered = filtered.filter(item => item.activity_type === filter.activityType)
    }

    // Apply resource type filter
    if (filter.resourceType !== 'all') {
      filtered = filtered.filter(item => item.resource_type === filter.resourceType)
    }

    // Apply time range filter
    if (filter.timeRange !== 'all') {
      const now = new Date()
      const cutoff = new Date()
      
      switch (filter.timeRange) {
        case '1h':
          cutoff.setHours(now.getHours() - 1)
          break
        case '24h':
          cutoff.setDate(now.getDate() - 1)
          break
        case '7d':
          cutoff.setDate(now.getDate() - 7)
          break
        case '30d':
          cutoff.setDate(now.getDate() - 30)
          break
      }
      
      filtered = filtered.filter(item => new Date(item.created_at) >= cutoff)
    }

    // Apply limit
    filtered = filtered.slice(0, limit)

    setFilteredActivity(filtered)
  }

  const refreshFeed = async () => {
    setIsLoading(true)
    try {
      await getActivityFeed(limit * 2) // Get more items to account for filtering
    } finally {
      setIsLoading(false)
    }
  }

  const getActivityIcon = (activityType: string, resourceType: string) => {
    if (activityType === 'created') {
      return <Plus className="w-4 h-4 text-green-600" />
    } else if (activityType === 'updated') {
      return <Edit className="w-4 h-4 text-blue-600" />
    } else if (activityType === 'deleted') {
      return <Trash className="w-4 h-4 text-red-600" />
    } else if (activityType === 'viewed') {
      return <Eye className="w-4 h-4 text-gray-600" />
    }

    // Fallback to resource type icons
    switch (resourceType) {
      case 'lead':
        return <User className="w-4 h-4 text-purple-600" />
      case 'campaign':
        return <Target className="w-4 h-4 text-orange-600" />
      case 'email':
        return <Mail className="w-4 h-4 text-blue-600" />
      default:
        return <FileText className="w-4 h-4 text-gray-600" />
    }
  }

  const getActivityColor = (activityType: string) => {
    switch (activityType) {
      case 'created': return 'border-l-green-500'
      case 'updated': return 'border-l-blue-500'
      case 'deleted': return 'border-l-red-500'
      case 'viewed': return 'border-l-gray-500'
      default: return 'border-l-gray-300'
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    
    return date.toLocaleDateString()
  }

  const activityTypes = [
    { value: 'all', label: 'All Activities' },
    { value: 'created', label: 'Created' },
    { value: 'updated', label: 'Updated' },
    { value: 'deleted', label: 'Deleted' },
    { value: 'viewed', label: 'Viewed' }
  ]

  const resourceTypes = [
    { value: 'all', label: 'All Resources' },
    { value: 'lead', label: 'Leads' },
    { value: 'campaign', label: 'Campaigns' },
    { value: 'email', label: 'Emails' },
    { value: 'template', label: 'Templates' }
  ]

  const timeRanges = [
    { value: 'all', label: 'All Time' },
    { value: '1h', label: 'Last Hour' },
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' }
  ]

  if (compact) {
    return (
      <div className={`space-y-2 ${className}`}>
        {filteredActivity.slice(0, 5).map((item) => (
          <div key={item.id} className="flex items-center gap-3 py-2">
            <Avatar className="w-6 h-6">
              <AvatarImage src={item.user_profiles?.avatar_url} />
              <AvatarFallback className="text-xs">
                {item.user_profiles?.first_name?.[0]}{item.user_profiles?.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-medium">
                  {item.user_profiles?.first_name} {item.user_profiles?.last_name}
                </span>
                {' '}
                <span className="text-muted-foreground">
                  {item.activity_type} {item.resource_type}
                </span>
                {item.resource_name && (
                  <span className="font-medium"> "{item.resource_name}"</span>
                )}
              </p>
            </div>
            
            <span className="text-xs text-muted-foreground">
              {formatTimeAgo(item.created_at)}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Team Activity
            </CardTitle>
            <CardDescription>
              Recent actions by your team members
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshFeed}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {showFilter && (
          <div className="flex items-center gap-2 pt-2">
            <Select 
              value={filter.activityType} 
              onValueChange={(value) => setFilter(prev => ({ ...prev, activityType: value }))}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {activityTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select 
              value={filter.resourceType} 
              onValueChange={(value) => setFilter(prev => ({ ...prev, resourceType: value }))}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {resourceTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select 
              value={filter.timeRange} 
              onValueChange={(value) => setFilter(prev => ({ ...prev, timeRange: value }))}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeRanges.map((range) => (
                  <SelectItem key={range.value} value={range.value}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0">
        {filteredActivity.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Activity className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No recent activity</p>
            <p className="text-sm text-muted-foreground">
              {filter.activityType !== 'all' || filter.resourceType !== 'all' || filter.timeRange !== 'all'
                ? 'Try adjusting your filters'
                : 'Activity will appear here as your team works'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-0">
            {filteredActivity.map((item, index) => (
              <div 
                key={item.id} 
                className={`
                  flex items-start gap-4 p-4 border-l-4 
                  ${getActivityColor(item.activity_type)}
                  ${index !== filteredActivity.length - 1 ? 'border-b' : ''}
                  hover:bg-muted/50 transition-colors
                `}
              >
                <div className="flex-shrink-0 pt-1">
                  {getActivityIcon(item.activity_type, item.resource_type)}
                </div>

                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarImage src={item.user_profiles?.avatar_url} />
                  <AvatarFallback className="text-xs">
                    {item.user_profiles?.first_name?.[0]}{item.user_profiles?.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm">
                        <span className="font-medium">
                          {item.user_profiles?.first_name} {item.user_profiles?.last_name}
                        </span>
                        {' '}
                        <span className="text-muted-foreground">
                          {item.activity_type}
                        </span>
                        {' '}
                        <Badge variant="outline" className="text-xs">
                          {item.resource_type}
                        </Badge>
                        {item.resource_name && (
                          <>
                            {' '}
                            <span className="font-medium">"{item.resource_name}"</span>
                          </>
                        )}
                      </p>
                      
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {item.description}
                        </p>
                      )}

                      {item.activity_data && Object.keys(item.activity_data).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {Object.entries(item.activity_data).slice(0, 3).map(([key, value]) => (
                            <Badge key={key} variant="secondary" className="text-xs">
                              {key}: {String(value).slice(0, 20)}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{formatTimeAgo(item.created_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Compact activity feed for sidebar
export function ActivityFeedSidebar({ className = '' }: { className?: string }) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4" />
        <h3 className="font-medium">Recent Activity</h3>
      </div>
      
      <ActivityFeed compact={true} limit={5} showFilter={false} />
    </div>
  )
}