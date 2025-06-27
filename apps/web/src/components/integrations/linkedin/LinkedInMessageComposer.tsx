'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Send, Linkedin, Sparkles, User } from 'lucide-react';
import { LinkedInMessage } from '@/lib/integrations/linkedin/types';

interface LinkedInMessageComposerProps {
  workspaceId: string;
  leadId: string;
  leadName: string;
  campaignId?: string;
  onMessageSent?: (message: LinkedInMessage) => void;
}

export function LinkedInMessageComposer({
  workspaceId,
  leadId,
  leadName,
  campaignId,
  onMessageSent,
}: LinkedInMessageComposerProps) {
  const { toast } = useToast();
  const [messageType, setMessageType] = useState<'connection_request' | 'inmail' | 'message'>('connection_request');
  const [content, setContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/integrations/linkedin/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          lead_id: leadId,
          content,
          message_type: messageType,
          campaign_id: campaignId,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send message');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Message Sent',
        description: `LinkedIn ${messageType.replace('_', ' ')} sent successfully to ${leadName}`,
      });
      setContent('');
      if (onMessageSent) {
        onMessageSent(data.data);
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Generate AI message
  const generateMessage = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          prompt: `Generate a personalized LinkedIn ${messageType.replace('_', ' ')} for ${leadName}. Keep it professional, concise, and engaging.`,
          type: 'linkedin_message',
          lead_id: leadId,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to generate message');
      
      const data = await response.json();
      setContent(data.content);
      
      toast({
        title: 'Message Generated',
        description: 'AI has generated a personalized message for you to review and send.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate message. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const getCharacterLimit = () => {
    switch (messageType) {
      case 'connection_request':
        return 300;
      case 'inmail':
        return 1900;
      case 'message':
        return 8000;
      default:
        return 300;
    }
  };

  const characterLimit = getCharacterLimit();
  const charactersRemaining = characterLimit - content.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Linkedin className="h-6 w-6 text-[#0077B5]" />
          <div>
            <CardTitle>Send LinkedIn Message</CardTitle>
            <CardDescription>
              Compose and send a personalized message to {leadName}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Message Type Selection */}
        <div className="space-y-2">
          <Label>Message Type</Label>
          <RadioGroup
            value={messageType}
            onValueChange={(value) => setMessageType(value as typeof messageType)}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="connection_request" id="connection_request" />
              <Label htmlFor="connection_request" className="flex items-center gap-2 cursor-pointer">
                Connection Request
                <Badge variant="outline" className="text-xs">300 chars</Badge>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="inmail" id="inmail" />
              <Label htmlFor="inmail" className="flex items-center gap-2 cursor-pointer">
                InMail
                <Badge variant="outline" className="text-xs">1900 chars</Badge>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="message" id="message" />
              <Label htmlFor="message" className="flex items-center gap-2 cursor-pointer">
                Direct Message
                <Badge variant="outline" className="text-xs">8000 chars</Badge>
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Message Content */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="content">Message</Label>
            <Button
              size="sm"
              variant="outline"
              onClick={generateMessage}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-3 w-3" />
                  Generate with AI
                </>
              )}
            </Button>
          </div>
          <Textarea
            id="content"
            placeholder={
              messageType === 'connection_request'
                ? "Hi! I'd love to connect and learn more about your work..."
                : "Hi! I came across your profile and was impressed by..."
            }
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={messageType === 'connection_request' ? 3 : 6}
            maxLength={characterLimit}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {messageType === 'connection_request' && 'Keep it brief and personal'}
              {messageType === 'inmail' && 'InMails have higher open rates'}
              {messageType === 'message' && 'Only for existing connections'}
            </span>
            <span className={charactersRemaining < 50 ? 'text-destructive' : ''}>
              {charactersRemaining} characters remaining
            </span>
          </div>
        </div>

        {/* Preview Section */}
        {content && (
          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">You → {leadName}</p>
                  <p className="text-sm whitespace-pre-wrap">{content}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Send Button */}
        <Button
          onClick={() => sendMessageMutation.mutate()}
          disabled={!content.trim() || sendMessageMutation.isPending}
          className="w-full"
        >
          {sendMessageMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Send {messageType.replace('_', ' ')}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}