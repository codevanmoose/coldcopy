'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Info, StopCircle, Mail, Clock, MessageSquare } from 'lucide-react'

interface SequenceSettingsProps {
  settings: {
    stop_on_reply?: boolean
    stop_on_bounce?: boolean
    stop_on_unsubscribe?: boolean
    reply_detection_mode?: 'all' | 'campaign_only' | 'none'
    auto_reply_action?: 'continue' | 'pause' | 'stop'
    max_emails_per_lead?: number
  }
  onSettingsChange: (settings: any) => void
}

export function SequenceSettings({ settings, onSettingsChange }: SequenceSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Sequence Behavior
        </CardTitle>
        <CardDescription>
          Configure how your sequence responds to lead actions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stop on Reply */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Label htmlFor="stop-on-reply" className="font-medium">
                Stop Sequence on Reply
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>
                      Automatically stops sending follow-ups when a lead replies to any email in the sequence
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-sm text-muted-foreground">
              Prevents over-emailing engaged leads
            </p>
          </div>
          <Switch
            id="stop-on-reply"
            checked={settings.stop_on_reply ?? true}
            onCheckedChange={(checked) => 
              onSettingsChange({ ...settings, stop_on_reply: checked })
            }
          />
        </div>

        {/* Stop on Bounce */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="stop-on-bounce" className="font-medium">
              Stop on Email Bounce
            </Label>
            <p className="text-sm text-muted-foreground">
              Stop sequence if email address is invalid
            </p>
          </div>
          <Switch
            id="stop-on-bounce"
            checked={settings.stop_on_bounce ?? true}
            onCheckedChange={(checked) => 
              onSettingsChange({ ...settings, stop_on_bounce: checked })
            }
          />
        </div>

        {/* Stop on Unsubscribe */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="stop-on-unsubscribe" className="font-medium">
              Stop on Unsubscribe
            </Label>
            <p className="text-sm text-muted-foreground">
              Respect unsubscribe requests immediately
            </p>
          </div>
          <Switch
            id="stop-on-unsubscribe"
            checked={settings.stop_on_unsubscribe ?? true}
            onCheckedChange={(checked) => 
              onSettingsChange({ ...settings, stop_on_unsubscribe: checked })
            }
            disabled // Always true for compliance
          />
        </div>

        {/* Reply Detection Mode */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="reply-detection" className="font-medium">
              Reply Detection Mode
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>
                    Choose which replies to detect: only campaign replies, all emails from the lead, or disable detection
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Select
            value={settings.reply_detection_mode || 'campaign_only'}
            onValueChange={(value) => 
              onSettingsChange({ ...settings, reply_detection_mode: value })
            }
          >
            <SelectTrigger id="reply-detection">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span>All Emails</span>
                </div>
              </SelectItem>
              <SelectItem value="campaign_only">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  <span>Campaign Replies Only</span>
                </div>
              </SelectItem>
              <SelectItem value="none">
                <div className="flex items-center gap-2">
                  <StopCircle className="h-4 w-4" />
                  <span>Disabled</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Auto-Reply Action */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="auto-reply-action" className="font-medium">
              Auto-Reply Handling
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>
                    What to do when we detect an out-of-office or automated reply
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Select
            value={settings.auto_reply_action || 'continue'}
            onValueChange={(value) => 
              onSettingsChange({ ...settings, auto_reply_action: value })
            }
          >
            <SelectTrigger id="auto-reply-action">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="continue">Continue Sequence</SelectItem>
              <SelectItem value="pause">Pause for 7 Days</SelectItem>
              <SelectItem value="stop">Stop Sequence</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Max Emails */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="max-emails" className="font-medium">
              Maximum Emails per Lead
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>
                    Safety limit to prevent over-emailing. Sequence stops after this many emails.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Select
            value={String(settings.max_emails_per_lead || 10)}
            onValueChange={(value) => 
              onSettingsChange({ ...settings, max_emails_per_lead: parseInt(value) })
            }
          >
            <SelectTrigger id="max-emails">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5 emails</SelectItem>
              <SelectItem value="10">10 emails</SelectItem>
              <SelectItem value="15">15 emails</SelectItem>
              <SelectItem value="20">20 emails</SelectItem>
              <SelectItem value="999">No limit</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Info Box */}
        <div className="rounded-lg bg-muted/50 p-4">
          <div className="flex gap-3">
            <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Smart Timing</p>
              <p className="text-sm text-muted-foreground">
                Our reply detection typically processes incoming emails within 1-2 minutes,
                ensuring sequences stop promptly when leads engage.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}