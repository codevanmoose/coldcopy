'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, AlertCircle, Webhook, Copy, CheckCircle, RefreshCw, Plus, Trash2, Activity, Calendar } from 'lucide-react';
import { WebhookSubscription } from './types';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';

const WEBHOOK_EVENTS = [
  { value: 'contact.creation', label: 'Contact Created', category: 'Contacts' },
  { value: 'contact.deletion', label: 'Contact Deleted', category: 'Contacts' },
  { value: 'contact.propertyChange', label: 'Contact Property Changed', category: 'Contacts' },
  { value: 'company.creation', label: 'Company Created', category: 'Companies' },
  { value: 'company.deletion', label: 'Company Deleted', category: 'Companies' },
  { value: 'company.propertyChange', label: 'Company Property Changed', category: 'Companies' },
  { value: 'deal.creation', label: 'Deal Created', category: 'Deals' },
  { value: 'deal.deletion', label: 'Deal Deleted', category: 'Deals' },
  { value: 'deal.propertyChange', label: 'Deal Property Changed', category: 'Deals' },
];

export function WebhookManager() {
  const [subscriptions, setSubscriptions] = useState<WebhookSubscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [showAddSubscription, setShowAddSubscription] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchWebhookConfig();
  }, []);

  const fetchWebhookConfig = async () => {
    try {
      const response = await fetch('/api/integrations/hubspot/webhooks/config');
      if (response.ok) {
        const data = await response.json();
        setSubscriptions(data.subscriptions || []);
        setWebhookUrl(data.webhookUrl || '');
      }
    } catch (error) {
      console.error('Error fetching webhook config:', error);
      toast({
        title: 'Error',
        description: 'Failed to load webhook configuration',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSubscription = async (id: string, active: boolean) => {
    try {
      const response = await fetch(`/api/integrations/hubspot/webhooks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      });

      if (response.ok) {
        setSubscriptions(subscriptions.map(s => 
          s.id === id ? { ...s, active } : s
        ));
        toast({
          title: 'Success',
          description: `Webhook ${active ? 'enabled' : 'disabled'} successfully`,
        });
      } else {
        throw new Error('Failed to update subscription');
      }
    } catch (error) {
      console.error('Error updating subscription:', error);
      toast({
        title: 'Error',
        description: 'Failed to update webhook subscription',
        variant: 'destructive',
      });
    }
  };

  const handleAddSubscription = async (eventType: string, propertyName?: string) => {
    try {
      setIsSaving(true);
      const response = await fetch('/api/integrations/hubspot/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType, propertyName }),
      });

      if (response.ok) {
        const newSubscription = await response.json();
        setSubscriptions([...subscriptions, newSubscription]);
        setShowAddSubscription(false);
        toast({
          title: 'Success',
          description: 'Webhook subscription created successfully',
        });
      } else {
        throw new Error('Failed to create subscription');
      }
    } catch (error) {
      console.error('Error creating subscription:', error);
      toast({
        title: 'Error',
        description: 'Failed to create webhook subscription',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSubscription = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook subscription?')) {
      return;
    }

    try {
      const response = await fetch(`/api/integrations/hubspot/webhooks/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSubscriptions(subscriptions.filter(s => s.id !== id));
        toast({
          title: 'Success',
          description: 'Webhook subscription deleted successfully',
        });
      } else {
        throw new Error('Failed to delete subscription');
      }
    } catch (error) {
      console.error('Error deleting subscription:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete webhook subscription',
        variant: 'destructive',
      });
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Webhook Configuration</CardTitle>
          <CardDescription>
            Receive real-time updates from HubSpot when data changes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Webhook Endpoint URL</Label>
            <div className="flex gap-2">
              <Input
                value={webhookUrl}
                readOnly
                placeholder="Webhook URL will appear here"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copyWebhookUrl}
                disabled={!webhookUrl}
              >
                {copiedUrl ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              This URL is automatically configured in HubSpot when you create subscriptions
            </p>
          </div>

          <Alert>
            <Webhook className="h-4 w-4" />
            <AlertTitle>How Webhooks Work</AlertTitle>
            <AlertDescription>
              When events occur in HubSpot (like contact updates), HubSpot sends data to your webhook URL in real-time.
              This enables instant synchronization between HubSpot and ColdCopy.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Active Subscriptions</CardTitle>
              <CardDescription>
                Configure which HubSpot events trigger webhooks
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setShowAddSubscription(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Subscription
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {subscriptions.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No webhook subscriptions configured. Add subscriptions to receive real-time updates from HubSpot.
              </AlertDescription>
            </Alert>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event Type</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Triggered</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((subscription) => (
                  <TableRow key={subscription.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Webhook className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {WEBHOOK_EVENTS.find(e => e.value === subscription.eventType)?.label || subscription.eventType}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {subscription.propertyName ? (
                        <Badge variant="outline">{subscription.propertyName}</Badge>
                      ) : (
                        <span className="text-muted-foreground">All properties</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={subscription.active ? 'success' : 'secondary'}>
                        {subscription.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {subscription.lastTriggered ? (
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {format(new Date(subscription.lastTriggered), 'MMM d, h:mm a')}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Switch
                          checked={subscription.active}
                          onCheckedChange={(checked) => 
                            handleToggleSubscription(subscription.id, checked)
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteSubscription(subscription.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhook Activity</CardTitle>
          <CardDescription>
            Monitor recent webhook deliveries and their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <Activity className="h-8 w-8 mr-2" />
            <span>Webhook activity monitoring coming soon</span>
          </div>
        </CardContent>
      </Card>

      {/* Add Subscription Dialog */}
      {showAddSubscription && (
        <AddSubscriptionDialog
          onAdd={handleAddSubscription}
          onClose={() => setShowAddSubscription(false)}
          isSaving={isSaving}
          existingSubscriptions={subscriptions}
        />
      )}
    </div>
  );
}

interface AddSubscriptionDialogProps {
  onAdd: (eventType: string, propertyName?: string) => void;
  onClose: () => void;
  isSaving: boolean;
  existingSubscriptions: WebhookSubscription[];
}

function AddSubscriptionDialog({ onAdd, onClose, isSaving, existingSubscriptions }: AddSubscriptionDialogProps) {
  const [selectedEvent, setSelectedEvent] = useState('');
  const [propertyName, setPropertyName] = useState('');

  const handleSubmit = () => {
    if (selectedEvent) {
      onAdd(selectedEvent, propertyName || undefined);
    }
  };

  const isPropertyChangeEvent = selectedEvent.includes('propertyChange');

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Add Webhook Subscription</CardTitle>
          <CardDescription>
            Choose which HubSpot events to subscribe to
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Event Type</Label>
            <Select value={selectedEvent} onValueChange={setSelectedEvent}>
              <SelectTrigger>
                <SelectValue placeholder="Select an event type" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(
                  WEBHOOK_EVENTS.reduce((acc, event) => {
                    if (!acc[event.category]) acc[event.category] = [];
                    acc[event.category].push(event);
                    return acc;
                  }, {} as Record<string, typeof WEBHOOK_EVENTS>)
                ).map(([category, events]) => (
                  <div key={category}>
                    <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
                      {category}
                    </div>
                    {events.map((event) => {
                      const isAlreadySubscribed = existingSubscriptions.some(
                        s => s.eventType === event.value && !s.propertyName
                      );
                      return (
                        <SelectItem 
                          key={event.value} 
                          value={event.value}
                          disabled={isAlreadySubscribed}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span>{event.label}</span>
                            {isAlreadySubscribed && (
                              <Badge variant="secondary" className="ml-2 text-xs">
                                Subscribed
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isPropertyChangeEvent && (
            <div className="space-y-2">
              <Label>Property Name (Optional)</Label>
              <Input
                value={propertyName}
                onChange={(e) => setPropertyName(e.target.value)}
                placeholder="e.g., email, firstname, company"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to receive updates for all property changes
              </p>
            </div>
          )}

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Webhook subscriptions will start receiving events immediately after creation.
              Make sure your webhook endpoint is ready to handle incoming requests.
            </AlertDescription>
          </Alert>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedEvent || isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Add Subscription
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}