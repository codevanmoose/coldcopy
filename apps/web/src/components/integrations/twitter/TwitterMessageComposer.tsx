'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Twitter, Send, Sparkles, MessageSquare, Users, Hash, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { TwitterProfile } from '@/lib/integrations/twitter';
import { useAuthStore } from '@/stores/auth';

interface TwitterMessageComposerProps {
  profile?: TwitterProfile;
  campaignId?: string;
  onSent?: (message: any) => void;
}

export function TwitterMessageComposer({ profile, campaignId, onSent }: TwitterMessageComposerProps) {
  const { workspace } = useAuthStore();
  const [messageType, setMessageType] = useState<'dm' | 'tweet'>('dm');
  const [content, setContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TwitterProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<TwitterProfile | undefined>(profile);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [generating, setGenerating] = useState(false);

  const characterLimit = messageType === 'tweet' ? 280 : 10000;
  const charactersRemaining = characterLimit - content.length;

  const handleSearch = async () => {
    if (!workspace?.id || !searchQuery.trim()) return;

    setSearching(true);
    try {
      const response = await fetch('/api/integrations/twitter/profiles/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspace.id,
          query: searchQuery,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to search profiles');
      }

      const data = await response.json();
      setSearchResults(data.profiles);
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to search Twitter profiles');
    } finally {
      setSearching(false);
    }
  };

  const handleGenerateContent = async () => {
    if (!workspace?.id || !selectedProfile) return;

    setGenerating(true);
    try {
      const prompt = messageType === 'dm' 
        ? `Write a personalized Twitter DM to ${selectedProfile.display_name || selectedProfile.username} (@${selectedProfile.username}). Their bio: "${selectedProfile.bio || 'No bio'}". Make it friendly, concise, and relevant to their interests.`
        : `Write an engaging tweet that would appeal to ${selectedProfile.display_name || selectedProfile.username} (@${selectedProfile.username}) based on their interests. Keep it under 280 characters.`;

      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspace.id,
          prompt,
          model: 'gpt-4-turbo-preview',
          maxTokens: 150,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate content');
      }

      const data = await response.json();
      setContent(data.content);
    } catch (error) {
      console.error('Generate error:', error);
      toast.error('Failed to generate content');
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!workspace?.id || !content.trim()) return;
    if (messageType === 'dm' && !selectedProfile) {
      toast.error('Please select a recipient for the direct message');
      return;
    }

    setLoading(true);
    try {
      if (messageType === 'dm') {
        const response = await fetch('/api/integrations/twitter/messages/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId: workspace.id,
            profileId: selectedProfile!.id,
            content,
            campaignId,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to send message');
        }

        const data = await response.json();
        toast.success('Direct message sent successfully');
        onSent?.(data.message);
      } else {
        // Tweet implementation would go here
        toast.info('Tweet functionality coming soon');
      }

      // Reset form
      setContent('');
      if (!profile) {
        setSelectedProfile(undefined);
      }
    } catch (error) {
      console.error('Send error:', error);
      toast.error('Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Twitter className="h-5 w-5" />
            <CardTitle>Compose Twitter Message</CardTitle>
          </div>
          <Badge variant={charactersRemaining < 0 ? 'destructive' : 'secondary'}>
            {charactersRemaining} characters
          </Badge>
        </div>
        <CardDescription>
          Send personalized messages or tweets to your Twitter connections
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <Tabs value={messageType} onValueChange={(value) => setMessageType(value as 'dm' | 'tweet')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="dm">
              <MessageSquare className="mr-2 h-4 w-4" />
              Direct Message
            </TabsTrigger>
            <TabsTrigger value="tweet">
              <Hash className="mr-2 h-4 w-4" />
              Tweet
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dm" className="space-y-4">
            {!profile && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Search Twitter users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <Button onClick={handleSearch} disabled={searching}>
                    {searching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Search'
                    )}
                  </Button>
                </div>

                {searchResults.length > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {searchResults.map((result) => (
                      <div
                        key={result.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedProfile?.id === result.id
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-muted'
                        }`}
                        onClick={() => setSelectedProfile(result)}
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={result.profile_image_url} />
                          <AvatarFallback>
                            {result.username[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium flex items-center gap-1">
                            {result.display_name || result.username}
                            {result.verified && (
                              <Badge variant="secondary" className="text-xs">
                                Verified
                              </Badge>
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            @{result.username} · {result.followers_count.toLocaleString()} followers
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {(selectedProfile || profile) && (
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={(selectedProfile || profile)!.profile_image_url} />
                  <AvatarFallback>
                    {(selectedProfile || profile)!.username[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">
                    {(selectedProfile || profile)!.display_name || (selectedProfile || profile)!.username}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    @{(selectedProfile || profile)!.username}
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="tweet">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Your tweet will be posted publicly on your Twitter timeline
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="content">Message</Label>
            {(selectedProfile || messageType === 'tweet') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGenerateContent}
                disabled={generating}
              >
                {generating ? (
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-3 w-3" />
                )}
                Generate with AI
              </Button>
            )}
          </div>
          <Textarea
            id="content"
            placeholder={messageType === 'dm' ? 'Type your message...' : 'What\'s happening?'}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={messageType === 'dm' ? 4 : 3}
            className={charactersRemaining < 0 ? 'border-destructive' : ''}
          />
        </div>
      </CardContent>

      <CardFooter>
        <Button
          onClick={handleSend}
          disabled={loading || !content.trim() || charactersRemaining < 0 || (messageType === 'dm' && !selectedProfile)}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Send {messageType === 'dm' ? 'Message' : 'Tweet'}
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}