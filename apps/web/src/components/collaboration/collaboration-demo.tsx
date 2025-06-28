'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Users, 
  Lock, 
  Activity, 
  Bell,
  Eye,
  Edit,
  Save,
  Plus
} from 'lucide-react'

import {
  CollaborationProvider,
  PresenceIndicator,
  TeamPresence,
  ResourceCollaborators,
  PresenceStatusSelector,
  CollisionGuard,
  LockIndicator,
  ActivityFeed,
  ActivityFeedSidebar,
  RealtimeNotifications,
  NotificationToast,
  useCollaboration,
  usePresence,
  useResourceLocks,
  useActivityFeed
} from './index'

// Demo lead editor with collision detection
function LeadEditorDemo() {
  const [leadData, setLeadData] = useState({
    name: 'John Smith',
    email: 'john.smith@example.com',
    company: 'Acme Corp',
    notes: 'Interested in our enterprise solution. Follow up next week.'
  })
  const [isEditing, setIsEditing] = useState(false)
  const { logActivity } = useActivityFeed()

  const leadId = 'demo-lead-123'

  const handleSave = async () => {
    setIsEditing(false)
    
    // Log the activity
    await logActivity(
      'updated',
      'lead',
      leadId,
      leadData.name,
      {
        description: 'Updated lead information',
        fields_changed: ['notes']
      }
    )
  }

  const handleStartEditing = async () => {
    setIsEditing(true)
    
    await logActivity(
      'viewed',
      'lead',
      leadId,
      leadData.name,
      {
        description: 'Started editing lead',
        action: 'edit_started'
      }
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Lead Profile
              <LockIndicator resourceType="lead" resourceId={leadId} />
            </CardTitle>
            <CardDescription>
              Edit lead information with real-time collaboration
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-2">
            <ResourceCollaborators resourceType="lead" resourceId={leadId} />
            
            {isEditing ? (
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave}>
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={handleStartEditing}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <CollisionGuard
          resourceType="lead"
          resourceId={leadId}
          lockType="editing"
          autoAcquire={isEditing}
          autoRelease={true}
          onLockAcquired={(lockId) => console.log('Lock acquired:', lockId)}
          onLockFailed={(error) => console.log('Lock failed:', error)}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={leadData.name}
                  onChange={(e) => setLeadData(prev => ({ ...prev, name: e.target.value }))}
                  disabled={!isEditing}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input
                  value={leadData.email}
                  onChange={(e) => setLeadData(prev => ({ ...prev, email: e.target.value }))}
                  disabled={!isEditing}
                />
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium">Company</label>
              <Input
                value={leadData.company}
                onChange={(e) => setLeadData(prev => ({ ...prev, company: e.target.value }))}
                disabled={!isEditing}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={leadData.notes}
                onChange={(e) => setLeadData(prev => ({ ...prev, notes: e.target.value }))}
                disabled={!isEditing}
                rows={3}
              />
            </div>
          </div>
        </CollisionGuard>
      </CardContent>
    </Card>
  )
}

// Demo campaign editor
function CampaignEditorDemo() {
  const [campaignData, setCampaignData] = useState({
    name: 'Q4 Outreach Campaign',
    subject: 'Exclusive offer for Q4',
    content: 'Hi {{first_name}}, we have an exclusive offer...'
  })
  const [isEditing, setIsEditing] = useState(false)
  const { logActivity } = useActivityFeed()

  const campaignId = 'demo-campaign-456'

  const handleSave = async () => {
    setIsEditing(false)
    
    await logActivity(
      'updated',
      'campaign',
      campaignId,
      campaignData.name,
      {
        description: 'Updated campaign content',
        changes: ['subject', 'content']
      }
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Campaign Editor
              <LockIndicator resourceType="campaign" resourceId={campaignId} />
            </CardTitle>
            <CardDescription>
              Collaborative campaign editing
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-2">
            <ResourceCollaborators resourceType="campaign" resourceId={campaignId} />
            
            {isEditing ? (
              <Button size="sm" onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
            ) : (
              <Button size="sm" onClick={() => setIsEditing(true)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <CollisionGuard
          resourceType="campaign"
          resourceId={campaignId}
          lockType="editing"
          autoAcquire={isEditing}
          autoRelease={true}
        >
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Campaign Name</label>
              <Input
                value={campaignData.name}
                onChange={(e) => setCampaignData(prev => ({ ...prev, name: e.target.value }))}
                disabled={!isEditing}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Subject Line</label>
              <Input
                value={campaignData.subject}
                onChange={(e) => setCampaignData(prev => ({ ...prev, subject: e.target.value }))}
                disabled={!isEditing}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Email Content</label>
              <Textarea
                value={campaignData.content}
                onChange={(e) => setCampaignData(prev => ({ ...prev, content: e.target.value }))}
                disabled={!isEditing}
                rows={6}
              />
            </div>
          </div>
        </CollisionGuard>
      </CardContent>
    </Card>
  )
}

// Presence and activity overview
function CollaborationOverview() {
  const { currentPresence, currentLocks, recentActivity } = useCollaboration()
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4" />
            Team Presence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <TeamPresence />
            
            <div className="space-y-2">
              {currentPresence.slice(0, 3).map((presence) => (
                <div key={presence.user_id} className="flex items-center gap-3">
                  <PresenceIndicator userId={presence.user_id} size="sm" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {presence.user_profiles?.first_name} {presence.user_profiles?.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {presence.current_page || 'Dashboard'}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {presence.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="w-4 h-4" />
            Active Locks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {currentLocks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active locks</p>
            ) : (
              currentLocks.slice(0, 3).map((lock) => (
                <div key={lock.id} className="flex items-center gap-3 p-2 bg-muted rounded">
                  <Lock className="w-4 h-4 text-orange-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {lock.resource_type} • {lock.lock_type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {lock.user_profiles?.first_name} {lock.user_profiles?.last_name}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="w-4 h-4" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityFeedSidebar />
        </CardContent>
      </Card>
    </div>
  )
}

// Main demo component
export function CollaborationDemo() {
  // Mock workspace and user IDs for demo
  const workspaceId = 'demo-workspace-123'
  const userId = 'demo-user-456'

  return (
    <CollaborationProvider workspaceId={workspaceId} userId={userId}>
      <div className="space-y-6">
        {/* Header with presence status and notifications */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Team Collaboration Demo</h1>
            <p className="text-muted-foreground">
              Real-time presence, collision detection, and activity tracking
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <PresenceStatusSelector />
            <RealtimeNotifications />
          </div>
        </div>

        {/* Overview cards */}
        <CollaborationOverview />

        {/* Demo editors */}
        <Tabs defaultValue="lead" className="space-y-4">
          <TabsList>
            <TabsTrigger value="lead">Lead Editor</TabsTrigger>
            <TabsTrigger value="campaign">Campaign Editor</TabsTrigger>
            <TabsTrigger value="activity">Activity Feed</TabsTrigger>
          </TabsList>
          
          <TabsContent value="lead" className="space-y-4">
            <LeadEditorDemo />
          </TabsContent>
          
          <TabsContent value="campaign" className="space-y-4">
            <CampaignEditorDemo />
          </TabsContent>
          
          <TabsContent value="activity" className="space-y-4">
            <ActivityFeed />
          </TabsContent>
        </Tabs>

        {/* Demo actions */}
        <Card>
          <CardHeader>
            <CardTitle>Test Collaboration Features</CardTitle>
            <CardDescription>
              Try these actions to see real-time collaboration in action
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={async () => {
                  // Simulate activity
                  const { logActivity } = useActivityFeed()
                  await logActivity(
                    'created',
                    'lead',
                    'new-lead-' + Date.now(),
                    'Jane Doe',
                    { description: 'Added new lead from demo' }
                  )
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Demo Activity
              </Button>
              
              <Button size="sm" variant="outline">
                <Eye className="w-4 h-4 mr-2" />
                View as Different User
              </Button>
              
              <Button size="sm" variant="outline">
                <Bell className="w-4 h-4 mr-2" />
                Send Test Notification
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notification toasts */}
      <NotificationToast />
    </CollaborationProvider>
  )
}