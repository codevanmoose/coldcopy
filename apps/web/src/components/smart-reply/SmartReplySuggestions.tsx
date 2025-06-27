'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  Loader2, 
  Sparkles, 
  ThumbsUp, 
  ThumbsDown, 
  Send, 
  Edit3, 
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  MessageSquare,
  Brain,
  Zap,
  CheckCircle
} from 'lucide-react';
import { 
  SmartReplyResponse, 
  ReplySuggestion, 
  MessageSentiment,
  MessageIntent,
  SuggestionType 
} from '@/lib/smart-reply/types';
import { useAuthStore } from '@/stores/auth';

interface SmartReplySuggestionsProps {
  messageId: string;
  messageType: 'email' | 'linkedin' | 'twitter';
  messageContent: string;
  senderName?: string;
  senderEmail?: string;
  conversationThreadId?: string;
  onSelectReply?: (content: string, suggestionId?: string) => void;
}

export function SmartReplySuggestions({
  messageId,
  messageType,
  messageContent,
  senderName,
  senderEmail,
  conversationThreadId,
  onSelectReply,
}: SmartReplySuggestionsProps) {
  const { workspace } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [smartReply, setSmartReply] = useState<SmartReplyResponse | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (workspace?.id) {
      analyzeMessage();
    }
  }, [workspace?.id, messageId]);

  const analyzeMessage = async () => {
    if (!workspace?.id) return;

    setLoading(true);
    try {
      const response = await fetch('/api/smart-reply/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspace.id,
          message_id: messageId,
          message_type: messageType,
          message_content: messageContent,
          sender_name: senderName,
          sender_email: senderEmail,
          conversation_thread_id: conversationThreadId,
          include_suggestions: true,
          suggestion_count: 3,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze message');
      }

      const data = await response.json();
      setSmartReply(data);
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to generate smart reply suggestions');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSuggestion = (suggestion: ReplySuggestion) => {
    setSelectedSuggestion(suggestion.id);
    setEditedContent(suggestion.content);
    setIsEditing(false);
  };

  const handleUseSuggestion = async () => {
    if (!workspace?.id || !selectedSuggestion || !editedContent) return;

    const suggestion = smartReply?.suggestions.find(s => s.id === selectedSuggestion);
    if (!suggestion) return;

    // Track usage
    try {
      await fetch('/api/smart-reply/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspace.id,
          suggestion_id: suggestion.id,
          sent_message_id: messageId,
          sent_message_type: messageType,
          sent_content: editedContent,
          was_edited: editedContent !== suggestion.content,
        }),
      });
    } catch (error) {
      console.error('Failed to track reply usage:', error);
    }

    // Send the reply content to parent
    onSelectReply?.(editedContent, suggestion.id);
    toast.success('Reply suggestion applied');
  };

  const getSentimentIcon = (sentiment: MessageSentiment) => {
    switch (sentiment) {
      case 'positive':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'negative':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'neutral':
        return <Minus className="h-4 w-4 text-gray-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getIntentIcon = (intent: MessageIntent) => {
    switch (intent) {
      case 'question':
        return '❓';
      case 'complaint':
        return '😟';
      case 'interest':
        return '🤩';
      case 'objection':
        return '🤔';
      case 'meeting_request':
        return '📅';
      case 'pricing_inquiry':
        return '💰';
      case 'feature_request':
        return '💡';
      case 'support_request':
        return '🆘';
      case 'unsubscribe':
        return '🚫';
      default:
        return '💬';
    }
  };

  const getSuggestionTypeLabel = (type: SuggestionType) => {
    const labels: Record<SuggestionType, string> = {
      quick_reply: 'Quick Reply',
      detailed_response: 'Detailed Response',
      follow_up: 'Follow Up',
      objection_handling: 'Handle Objection',
      meeting_proposal: 'Propose Meeting',
      closing: 'Close Deal',
    };
    return labels[type];
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Analyzing message and generating suggestions...</span>
        </CardContent>
      </Card>
    );
  }

  if (!smartReply) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            <CardTitle>Smart Reply Suggestions</CardTitle>
          </div>
          <Badge variant="secondary">
            <Sparkles className="mr-1 h-3 w-3" />
            AI Powered
          </Badge>
        </div>
        <CardDescription>
          AI-generated response suggestions based on message analysis
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Message Analysis */}
        <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Message Analysis
          </h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Sentiment:</span>
              <div className="flex items-center gap-1">
                {getSentimentIcon(smartReply.analysis.sentiment)}
                <span className="text-sm font-medium capitalize">
                  {smartReply.analysis.sentiment}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({smartReply.analysis.sentiment_score.toFixed(2)})
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Intent:</span>
              <div className="flex items-center gap-1">
                <span>{getIntentIcon(smartReply.analysis.intent)}</span>
                <span className="text-sm font-medium capitalize">
                  {smartReply.analysis.intent.replace('_', ' ')}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({(smartReply.analysis.intent_confidence * 100).toFixed(0)}%)
                </span>
              </div>
            </div>
          </div>

          {smartReply.analysis.topics.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-sm text-muted-foreground">Topics:</span>
              <div className="flex flex-wrap gap-1">
                {smartReply.analysis.topics.map((topic, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {smartReply.context && (
            <div className="flex items-center gap-2 text-sm">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                Conversation: {smartReply.context.message_count} messages
              </span>
              {smartReply.context.conversation_stage && (
                <Badge variant="secondary" className="text-xs">
                  {smartReply.context.conversation_stage.replace('_', ' ')}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Reply Suggestions */}
        <div className="space-y-3">
          <h4 className="font-medium">Suggested Replies</h4>
          
          <Tabs value={selectedSuggestion || undefined} onValueChange={setSelectedSuggestion}>
            <TabsList className="grid w-full grid-cols-3">
              {smartReply.suggestions.map((suggestion, index) => (
                <TabsTrigger key={suggestion.id} value={suggestion.id}>
                  {getSuggestionTypeLabel(suggestion.suggestion_type)}
                  {suggestion.id === smartReply.recommended_suggestion_id && (
                    <CheckCircle className="ml-1 h-3 w-3" />
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {smartReply.suggestions.map((suggestion) => (
              <TabsContent key={suggestion.id} value={suggestion.id} className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{suggestion.tone}</Badge>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span>Relevance: {(suggestion.relevance_score * 100).toFixed(0)}%</span>
                        <span>•</span>
                        <span>Personalization: {(suggestion.personalization_score * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                    {suggestion.id === smartReply.recommended_suggestion_id && (
                      <Badge variant="default" className="text-xs">
                        Recommended
                      </Badge>
                    )}
                  </div>

                  {!isEditing ? (
                    <div className="relative">
                      <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                        {editedContent || suggestion.content}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => {
                          setIsEditing(true);
                          setEditedContent(editedContent || suggestion.content);
                        }}
                      >
                        <Edit3 className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Textarea
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        rows={4}
                        className="resize-none"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => setIsEditing(false)}
                        >
                          Save
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditedContent(suggestion.content);
                            setIsEditing(false);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {suggestion.personalization_used.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Personalization:</span>
                      <div className="flex gap-1">
                        {suggestion.personalization_used.map((element, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {element}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </CardContent>

      <CardFooter>
        <Button
          onClick={handleUseSuggestion}
          disabled={!selectedSuggestion || !editedContent}
          className="w-full"
        >
          <Send className="mr-2 h-4 w-4" />
          Use This Reply
        </Button>
      </CardFooter>
    </Card>
  );
}