'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { 
  Loader2, 
  Linkedin, 
  Search, 
  Building, 
  MapPin, 
  Briefcase,
  Link,
  Calendar,
  User,
  RefreshCw
} from 'lucide-react';
import { LinkedInProfile } from '@/lib/integrations/linkedin/types';

interface LinkedInProfileEnrichmentProps {
  workspaceId: string;
  leadId: string;
  leadName: string;
  existingLinkedInUrl?: string;
  onEnrichmentComplete?: (profile: LinkedInProfile) => void;
}

export function LinkedInProfileEnrichment({
  workspaceId,
  leadId,
  leadName,
  existingLinkedInUrl,
  onEnrichmentComplete,
}: LinkedInProfileEnrichmentProps) {
  const { toast } = useToast();
  const [linkedInUrl, setLinkedInUrl] = useState(existingLinkedInUrl || '');

  // Fetch existing LinkedIn profile
  const { data: existingProfile, isLoading, refetch } = useQuery({
    queryKey: ['linkedin-profile', workspaceId, leadId],
    queryFn: async () => {
      const response = await fetch(
        `/api/integrations/linkedin/profile?workspace_id=${workspaceId}&lead_id=${leadId}`
      );
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch LinkedIn profile');
      }
      const data = await response.json();
      return data.profile as LinkedInProfile | null;
    },
  });

  // Enrich profile mutation
  const enrichMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/integrations/linkedin/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          lead_id: leadId,
          linkedin_url: linkedInUrl || undefined,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to enrich profile');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Profile Enriched',
        description: `Successfully enriched LinkedIn profile for ${leadName}`,
      });
      refetch();
      if (onEnrichmentComplete) {
        onEnrichmentComplete(data.data);
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Enrichment Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (existingProfile) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Linkedin className="h-6 w-6 text-[#0077B5]" />
              <div>
                <CardTitle>LinkedIn Profile</CardTitle>
                <CardDescription>
                  Last enriched {new Date(existingProfile.last_enriched_at!).toLocaleDateString()}
                </CardDescription>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => enrichMutation.mutate()}
              disabled={enrichMutation.isPending}
            >
              {enrichMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-3 w-3" />
                  Refresh
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Profile Info */}
          <div className="space-y-3">
            {existingProfile.profile_url && (
              <div className="flex items-center gap-2">
                <Link className="h-4 w-4 text-muted-foreground" />
                <a
                  href={existingProfile.profile_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  View LinkedIn Profile
                </a>
              </div>
            )}
            
            {existingProfile.headline && (
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                <p className="text-sm">{existingProfile.headline}</p>
              </div>
            )}
            
            {existingProfile.current_title && existingProfile.current_company && (
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm">
                  {existingProfile.current_title} at {existingProfile.current_company}
                </p>
              </div>
            )}
            
            {existingProfile.location_name && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm">{existingProfile.location_name}</p>
              </div>
            )}
            
            {existingProfile.industry && (
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm">{existingProfile.industry}</p>
              </div>
            )}
          </div>

          {/* Connection Status */}
          <div className="flex items-center gap-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Connection:</span>
              {existingProfile.is_connected ? (
                <Badge variant="default">Connected</Badge>
              ) : existingProfile.connection_request_sent_at ? (
                <Badge variant="secondary">Request Sent</Badge>
              ) : (
                <Badge variant="outline">Not Connected</Badge>
              )}
            </div>
            
            {existingProfile.connection_degree && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Degree:</span>
                <Badge variant="outline">{existingProfile.connection_degree}°</Badge>
              </div>
            )}
          </div>

          {/* Engagement History */}
          {(existingProfile.last_message_sent_at || existingProfile.connected_at) && (
            <div className="space-y-2 pt-4 border-t">
              <Label className="text-sm">Engagement History</Label>
              <div className="space-y-1">
                {existingProfile.connected_at && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    Connected on {new Date(existingProfile.connected_at).toLocaleDateString()}
                  </div>
                )}
                {existingProfile.last_message_sent_at && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    Last message sent {new Date(existingProfile.last_message_sent_at).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Linkedin className="h-6 w-6 text-[#0077B5]" />
          <div>
            <CardTitle>Enrich with LinkedIn</CardTitle>
            <CardDescription>
              Find and enrich {leadName}'s LinkedIn profile
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="linkedin-url">LinkedIn Profile URL (Optional)</Label>
          <Input
            id="linkedin-url"
            type="url"
            placeholder="https://linkedin.com/in/username"
            value={linkedInUrl}
            onChange={(e) => setLinkedInUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Leave empty to auto-search by name and company
          </p>
        </div>

        <Button
          onClick={() => enrichMutation.mutate()}
          disabled={enrichMutation.isPending}
          className="w-full"
        >
          {enrichMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enriching Profile...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              Enrich LinkedIn Profile
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}