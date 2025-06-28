'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { 
  Key, 
  Copy, 
  Eye, 
  EyeOff, 
  MoreVertical, 
  Plus,
  Shield,
  AlertCircle,
  Check,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { SCOPE_GROUPS } from '@/lib/security/api-keys';

interface ApiKey {
  id: string;
  name: string;
  key_preview: string;
  scopes: string[];
  expires_at?: string;
  last_used_at?: string;
  created_at: string;
  is_active: boolean;
  description?: string;
  usage_last_30_days?: number;
}

interface ApiKeysProps {
  workspaceId: string;
}

export function ApiKeys({ workspaceId }: ApiKeysProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [showKey, setShowKey] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch API keys
  const { data, isLoading } = useQuery({
    queryKey: ['api-keys', workspaceId],
    queryFn: async () => {
      const response = await fetch(`/api/workspace/api-keys?workspaceId=${workspaceId}`);
      if (!response.ok) throw new Error('Failed to fetch API keys');
      return response.json();
    },
  });

  // Create API key mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/workspace/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, workspaceId }),
      });
      if (!response.ok) throw new Error('Failed to create API key');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys', workspaceId] });
      setShowKey(data.apiKey.key);
      toast({
        title: 'API key created',
        description: 'Make sure to copy your API key now. You will not be able to see it again!',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create API key',
        variant: 'destructive',
      });
    },
  });

  // Revoke API key mutation
  const revokeMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const response = await fetch(`/api/workspace/api-keys/${keyId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to revoke API key');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys', workspaceId] });
      toast({
        title: 'API key revoked',
        description: 'The API key has been permanently revoked.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to revoke API key',
        variant: 'destructive',
      });
    },
  });

  const copyToClipboard = async (text: string, keyId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKeyId(keyId);
      setTimeout(() => setCopiedKeyId(null), 2000);
      toast({
        title: 'Copied',
        description: 'API key copied to clipboard',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>API Keys</CardTitle>
            <CardDescription>
              Manage API keys for programmatic access to your workspace
            </CardDescription>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create API Key
              </Button>
            </DialogTrigger>
            <CreateApiKeyDialog
              onClose={() => setIsCreateOpen(false)}
              onCreate={createMutation.mutate}
              isLoading={createMutation.isPending}
            />
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading API keys...</div>
        ) : data?.apiKeys?.length === 0 ? (
          <div className="text-center py-8">
            <Key className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500">No API keys yet</p>
            <p className="text-sm text-gray-400 mt-2">
              Create an API key to enable programmatic access
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {data?.apiKeys?.map((apiKey: ApiKey) => (
              <div
                key={apiKey.id}
                className={cn(
                  'flex items-center justify-between p-4 border rounded-lg',
                  !apiKey.is_active && 'opacity-50'
                )}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-gray-400" />
                    <div>
                      <h4 className="font-medium">{apiKey.name}</h4>
                      <p className="text-sm text-gray-500">
                        {apiKey.key_preview} • Created {format(new Date(apiKey.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                    {!apiKey.is_active && (
                      <Badge variant="secondary">Revoked</Badge>
                    )}
                    {apiKey.expires_at && new Date(apiKey.expires_at) < new Date() && (
                      <Badge variant="destructive">Expired</Badge>
                    )}
                  </div>
                  
                  {apiKey.description && (
                    <p className="text-sm text-gray-600 mt-2 ml-8">{apiKey.description}</p>
                  )}
                  
                  <div className="mt-3 ml-8 flex flex-wrap gap-2">
                    {apiKey.scopes.map((scope) => (
                      <Badge key={scope} variant="outline" className="text-xs">
                        {scope}
                      </Badge>
                    ))}
                  </div>
                  
                  <div className="mt-3 ml-8 flex items-center gap-4 text-xs text-gray-500">
                    {apiKey.last_used_at ? (
                      <span>Last used {format(new Date(apiKey.last_used_at), 'MMM d, yyyy')}</span>
                    ) : (
                      <span>Never used</span>
                    )}
                    {apiKey.usage_last_30_days !== undefined && (
                      <span>{apiKey.usage_last_30_days} requests in last 30 days</span>
                    )}
                    {apiKey.expires_at && (
                      <span>
                        Expires {format(new Date(apiKey.expires_at), 'MMM d, yyyy')}
                      </span>
                    )}
                  </div>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => copyToClipboard(apiKey.key_preview, apiKey.id)}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy Preview
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => revokeMutation.mutate(apiKey.id)}
                      disabled={!apiKey.is_active}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Revoke Key
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
        
        {showKey && (
          <Dialog open={true} onOpenChange={() => setShowKey(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>API Key Created</DialogTitle>
                <DialogDescription>
                  Copy your API key now. You won't be able to see it again!
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg font-mono text-sm break-all">
                  {showKey}
                </div>
                
                <Button
                  className="w-full"
                  onClick={() => copyToClipboard(showKey, 'new')}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy API Key
                </Button>
                
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="space-y-2 text-sm">
                      <p className="font-medium text-yellow-900">Security Notice</p>
                      <ul className="space-y-1 text-yellow-800 list-disc list-inside">
                        <li>Store this key securely in your environment variables</li>
                        <li>Never commit API keys to version control</li>
                        <li>Rotate keys regularly for better security</li>
                        <li>Use IP allowlisting for additional security</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              
              <DialogFooter>
                <Button onClick={() => setShowKey(null)}>
                  I've Copied the Key
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}

interface CreateApiKeyDialogProps {
  onClose: () => void;
  onCreate: (data: any) => void;
  isLoading: boolean;
}

function CreateApiKeyDialog({ onClose, onCreate, isLoading }: CreateApiKeyDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [expiresIn, setExpiresIn] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate({
      name,
      description: description || undefined,
      scopes: selectedScopes,
      expiresIn: expiresIn ? parseInt(expiresIn) : undefined,
    });
  };

  const toggleScope = (scope: string) => {
    setSelectedScopes(prev =>
      prev.includes(scope)
        ? prev.filter(s => s !== scope)
        : [...prev, scope]
    );
  };

  const selectAllInGroup = (scopes: { value: string }[]) => {
    const groupScopes = scopes.map(s => s.value);
    const allSelected = groupScopes.every(s => selectedScopes.includes(s));
    
    if (allSelected) {
      setSelectedScopes(prev => prev.filter(s => !groupScopes.includes(s)));
    } else {
      setSelectedScopes(prev => [...new Set([...prev, ...groupScopes])]);
    }
  };

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>Create API Key</DialogTitle>
          <DialogDescription>
            Create a new API key with specific permissions for your workspace
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-6">
          <div className="space-y-2">
            <Label htmlFor="name">Key Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Production API Key"
              required
            />
            <p className="text-sm text-gray-500">
              A descriptive name to identify this key
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Used for production email sending"
              rows={3}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="expires">Expiration (Optional)</Label>
            <select
              id="expires"
              value={expiresIn}
              onChange={(e) => setExpiresIn(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="">Never expires</option>
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
              <option value="180">180 days</option>
              <option value="365">1 year</option>
            </select>
          </div>
          
          <div className="space-y-3">
            <Label>Permissions</Label>
            <p className="text-sm text-gray-500">
              Select the scopes this API key should have access to
            </p>
            
            {Object.entries(SCOPE_GROUPS).map(([group, scopes]) => (
              <div key={group} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">{group}</h4>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() => selectAllInGroup(scopes)}
                  >
                    {scopes.every(s => selectedScopes.includes(s.value))
                      ? 'Deselect all'
                      : 'Select all'}
                  </Button>
                </div>
                <div className="space-y-2 pl-4">
                  {scopes.map((scope) => (
                    <div key={scope.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={scope.value}
                        checked={selectedScopes.includes(scope.value)}
                        onCheckedChange={() => toggleScope(scope.value)}
                      />
                      <Label
                        htmlFor={scope.value}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {scope.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading || selectedScopes.length === 0}>
            {isLoading ? 'Creating...' : 'Create API Key'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}