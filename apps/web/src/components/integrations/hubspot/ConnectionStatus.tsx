'use client';

import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { CheckCircle, Clock, Key, Shield } from 'lucide-react';
import { HubSpotConnectionStatus } from './types';

interface ConnectionStatusProps {
  status: HubSpotConnectionStatus;
}

export function ConnectionStatus({ status }: ConnectionStatusProps) {
  const formatScope = (scope: string) => {
    return scope
      .split('.')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Portal ID</p>
              <p className="text-2xl font-bold">{status.hubId}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Last Verified</p>
              <p className="text-sm text-muted-foreground">
                {status.lastVerified 
                  ? format(new Date(status.lastVerified), 'MMM d, yyyy h:mm a')
                  : 'Never'}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Key className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Token Expires</p>
              <p className="text-sm text-muted-foreground">
                {status.expiresAt 
                  ? format(new Date(status.expiresAt), 'MMM d, yyyy h:mm a')
                  : 'No expiry'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {status.scopes && status.scopes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-medium">Granted Permissions</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {status.scopes.map((scope) => (
              <Badge key={scope} variant="secondary" className="text-xs">
                {formatScope(scope)}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}