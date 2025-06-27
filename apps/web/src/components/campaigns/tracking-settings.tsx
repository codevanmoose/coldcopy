'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Info, Eye, MousePointer, Link2, Shield } from 'lucide-react'

interface TrackingSettingsProps {
  trackOpens: boolean
  trackClicks: boolean
  trackReplies: boolean
  onTrackingChange: (settings: {
    trackOpens?: boolean
    trackClicks?: boolean
    trackReplies?: boolean
  }) => void
}

export function TrackingSettings({
  trackOpens,
  trackClicks,
  trackReplies,
  onTrackingChange,
}: TrackingSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Tracking & Privacy
        </CardTitle>
        <CardDescription>
          Configure how you track engagement with your emails
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Open Tracking */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Label htmlFor="track-opens" className="font-medium">
                Track Email Opens
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>
                      Adds an invisible tracking pixel to know when recipients open your emails.
                      Some email clients may block this.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-sm text-muted-foreground">
              See who opened your emails and when
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <Switch
              id="track-opens"
              checked={trackOpens}
              onCheckedChange={(checked) => onTrackingChange({ trackOpens: checked })}
            />
          </div>
        </div>

        {/* Click Tracking */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Label htmlFor="track-clicks" className="font-medium">
                Track Link Clicks
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>
                      Wraps links to track when recipients click them.
                      Links will redirect through your tracking server.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-sm text-muted-foreground">
              Monitor which links get the most engagement
            </p>
          </div>
          <div className="flex items-center gap-2">
            <MousePointer className="h-4 w-4 text-muted-foreground" />
            <Switch
              id="track-clicks"
              checked={trackClicks}
              onCheckedChange={(checked) => onTrackingChange({ trackClicks: checked })}
            />
          </div>
        </div>

        {/* Reply Detection */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Label htmlFor="track-replies" className="font-medium">
                Detect Replies
              </Label>
              <Badge variant="secondary" className="text-xs">
                Coming Soon
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Automatically detect and track email replies
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <Switch
              id="track-replies"
              checked={trackReplies}
              onCheckedChange={(checked) => onTrackingChange({ trackReplies: checked })}
              disabled
            />
          </div>
        </div>

        {/* Privacy Notice */}
        <div className="rounded-lg bg-muted/50 p-4">
          <div className="flex gap-3">
            <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Privacy Compliance</p>
              <p className="text-sm text-muted-foreground">
                All tracking is GDPR compliant. Recipients can opt-out via unsubscribe links,
                and we respect "Do Not Track" browser settings.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}