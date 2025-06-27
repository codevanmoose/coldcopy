'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Info, Calendar, Clock } from 'lucide-react'

interface ScheduleSettings {
  startDate: string
  timezone: string
  dailyLimit: number
  sendBetween: {
    start: string
    end: string
  }
  excludeWeekends: boolean
}

interface CampaignSchedulerProps {
  settings: ScheduleSettings
  onSettingsChange: (settings: ScheduleSettings) => void
}

const timezones = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'Eastern Time (US & Canada)' },
  { value: 'America/Chicago', label: 'Central Time (US & Canada)' },
  { value: 'America/Denver', label: 'Mountain Time (US & Canada)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Paris', label: 'Paris' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Asia/Shanghai', label: 'Beijing, Shanghai' },
  { value: 'Australia/Sydney', label: 'Sydney' },
]

export function CampaignScheduler({ settings, onSettingsChange }: CampaignSchedulerProps) {
  const updateSettings = (updates: Partial<ScheduleSettings>) => {
    onSettingsChange({ ...settings, ...updates })
  }

  const updateSendWindow = (field: 'start' | 'end', value: string) => {
    updateSettings({
      sendBetween: {
        ...settings.sendBetween,
        [field]: value,
      },
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Start Date & Time</CardTitle>
          <CardDescription>
            When should this campaign begin sending?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="startDate"
                  type="date"
                  value={settings.startDate}
                  onChange={(e) => updateSettings({ startDate: e.target.value })}
                  className="pl-10"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                value={settings.timezone}
                onValueChange={(value) => updateSettings({ timezone: value })}
              >
                <SelectTrigger id="timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timezones.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sending Window</CardTitle>
          <CardDescription>
            Control when emails are sent during the day
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sendStart">Send Between</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="sendStart"
                    type="time"
                    value={settings.sendBetween.start}
                    onChange={(e) => updateSendWindow('start', e.target.value)}
                    className="pl-10"
                  />
                </div>
                <span className="text-muted-foreground">and</span>
                <div className="relative flex-1">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="time"
                    value={settings.sendBetween.end}
                    onChange={(e) => updateSendWindow('end', e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                In recipient's timezone when available
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dailyLimit">Daily Send Limit</Label>
              <Input
                id="dailyLimit"
                type="number"
                min="1"
                max="1000"
                value={settings.dailyLimit}
                onChange={(e) => updateSettings({ dailyLimit: parseInt(e.target.value) || 50 })}
              />
              <p className="text-xs text-muted-foreground">
                Maximum emails to send per day
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between space-y-0 rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="excludeWeekends" className="text-base cursor-pointer">
                Skip Weekends
              </Label>
              <p className="text-sm text-muted-foreground">
                Don't send emails on Saturdays and Sundays
              </p>
            </div>
            <Switch
              id="excludeWeekends"
              checked={settings.excludeWeekends}
              onCheckedChange={(checked) => updateSettings({ excludeWeekends: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Smart Scheduling:</strong> Emails will be automatically spaced throughout 
          the sending window to maintain natural pacing. The system respects rate limits 
          and ensures optimal deliverability.
        </AlertDescription>
      </Alert>

      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-base">Schedule Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">First email:</span>
              <span className="font-medium">
                {new Date(settings.startDate).toLocaleDateString()} at {settings.sendBetween.start}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Daily volume:</span>
              <span className="font-medium">Up to {settings.dailyLimit} emails</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Send window:</span>
              <span className="font-medium">
                {settings.sendBetween.start} - {settings.sendBetween.end} {settings.timezone}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Weekends:</span>
              <span className="font-medium">
                {settings.excludeWeekends ? 'Excluded' : 'Included'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}