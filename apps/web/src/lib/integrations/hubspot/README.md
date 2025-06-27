# HubSpot Integration

## Overview

The HubSpot integration provides bi-directional sync between ColdCopy and HubSpot CRM, enabling:
- Contact and company synchronization
- Email activity logging (opens, clicks, replies)
- Custom property mapping
- Workflow triggers based on email engagement
- Real-time updates via webhooks

## Architecture

### Components

1. **OAuth2 Authentication** (`auth.ts`)
   - OAuth flow implementation
   - Token management and refresh
   - Secure storage of credentials

2. **API Client** (`client.ts`)
   - Rate-limited API wrapper
   - Automatic retry logic
   - Error handling

3. **Contact Sync** (`contacts.ts`)
   - Create/update contacts
   - Bi-directional sync
   - Conflict resolution

4. **Activity Logging** (`activities.ts`)
   - Email engagement tracking
   - Timeline events
   - Custom engagement scoring

5. **Property Mapping** (`properties.ts`)
   - Dynamic field mapping
   - Custom property creation
   - Data transformation

6. **Workflow Triggers** (`workflows.ts`)
   - Email engagement-based triggers
   - Contact property updates
   - HubSpot workflow enrollment
   - Custom action execution

7. **Webhook Handler** (`webhooks.ts`)
   - Real-time updates
   - Event processing
   - Queue management

## Data Flow

```
ColdCopy Lead ←→ Sync Engine ←→ HubSpot Contact
     ↓                              ↓
Email Events  →  Activity Logger → Timeline Events
     ↓                              ↓
Engagement    →  Workflow Trigger → HubSpot Workflows
```

## Integration Points

### 1. Lead to Contact Sync
- When: Lead created/updated in ColdCopy
- Action: Create/update contact in HubSpot
- Fields: Email, name, company, custom properties

### 2. Contact to Lead Sync
- When: Contact updated in HubSpot
- Action: Update lead in ColdCopy
- Fields: All mapped properties

### 3. Email Activity Logging
- When: Email sent, opened, clicked, replied
- Action: Create timeline event in HubSpot
- Data: Timestamp, email content, engagement type

### 4. Workflow Triggers
- When: Email engagement threshold met
- Action: Trigger HubSpot workflow
- Events: High engagement, positive reply, unsubscribe

## API Endpoints

### OAuth
- `GET /api/integrations/hubspot/auth` - Initiate OAuth flow
- `GET /api/integrations/hubspot/callback` - OAuth callback
- `POST /api/integrations/hubspot/disconnect` - Revoke access

### Configuration
- `GET /api/integrations/hubspot/config` - Get integration config
- `PUT /api/integrations/hubspot/config` - Update config
- `GET /api/integrations/hubspot/properties` - List available properties
- `POST /api/integrations/hubspot/mappings` - Save field mappings

### Sync Operations
- `POST /api/integrations/hubspot/sync/contacts` - Manual contact sync
- `POST /api/integrations/hubspot/sync/activities` - Sync activities
- `GET /api/integrations/hubspot/sync/status` - Sync status

### Workflow Management
- `GET /api/integrations/hubspot/workflows` - List workflow triggers
- `POST /api/integrations/hubspot/workflows` - Create workflow trigger
- `PUT /api/integrations/hubspot/workflows` - Update workflow trigger
- `DELETE /api/integrations/hubspot/workflows` - Delete workflow trigger
- `POST /api/integrations/hubspot/workflows/test` - Test workflow trigger
- `POST /api/integrations/hubspot/workflows/process` - Process engagement event

### Webhooks
- `POST /api/integrations/hubspot/webhooks` - Webhook endpoint
- `POST /api/integrations/hubspot/webhooks/verify` - Verify webhook

## Database Schema

```sql
-- HubSpot integration settings
CREATE TABLE hubspot_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  hub_id TEXT NOT NULL, -- HubSpot account ID
  access_token TEXT ENCRYPTED,
  refresh_token TEXT ENCRYPTED,
  expires_at TIMESTAMP,
  scopes TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Field mappings
CREATE TABLE hubspot_field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  coldcopy_field TEXT NOT NULL,
  hubspot_property TEXT NOT NULL,
  direction TEXT CHECK (direction IN ('to_hubspot', 'from_hubspot', 'bidirectional')),
  transform_function TEXT, -- Optional data transformation
  created_at TIMESTAMP DEFAULT NOW()
);

-- Sync status tracking
CREATE TABLE hubspot_sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  entity_type TEXT CHECK (entity_type IN ('contact', 'company', 'activity')),
  entity_id UUID,
  hubspot_id TEXT,
  last_synced_at TIMESTAMP,
  sync_hash TEXT, -- For change detection
  status TEXT CHECK (status IN ('pending', 'synced', 'error')),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Activity log
CREATE TABLE hubspot_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  lead_id UUID REFERENCES leads(id),
  hubspot_contact_id TEXT,
  activity_type TEXT,
  activity_data JSONB,
  synced_at TIMESTAMP DEFAULT NOW()
);

-- Workflow triggers
CREATE TABLE hubspot_workflow_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  event_type VARCHAR(50) NOT NULL,
  conditions JSONB DEFAULT '[]'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  hubspot_workflow_id VARCHAR(255),
  property_updates JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Workflow execution logs
CREATE TABLE hubspot_workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  trigger_id UUID REFERENCES hubspot_workflow_triggers(id),
  event_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  lead_id UUID REFERENCES leads(id),
  hubspot_contact_id VARCHAR(255),
  execution_time TIMESTAMP DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'pending',
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);
```

## Configuration

### Environment Variables
```env
# HubSpot OAuth
HUBSPOT_CLIENT_ID=your_client_id
HUBSPOT_CLIENT_SECRET=your_client_secret
HUBSPOT_REDIRECT_URI=https://app.coldcopy.cc/api/integrations/hubspot/callback

# HubSpot API
HUBSPOT_API_BASE_URL=https://api.hubapi.com
HUBSPOT_API_VERSION=v3
```

### Scopes Required
- `crm.objects.contacts.read`
- `crm.objects.contacts.write`
- `crm.objects.companies.read`
- `crm.objects.companies.write`
- `crm.objects.deals.read`
- `crm.objects.deals.write`
- `sales-email-read`
- `timeline`

## Rate Limiting

HubSpot API limits:
- 100 requests per 10 seconds
- 250,000 requests per day

Our implementation:
- Token bucket algorithm
- Queue for batch operations
- Exponential backoff on 429 errors

## Error Handling

### Retry Strategy
1. Network errors: 3 retries with exponential backoff
2. Rate limits: Wait and retry based on headers
3. Server errors (5xx): Retry with backoff
4. Client errors (4xx): Log and skip

### Error Types
- `HubSpotAuthError`: Authentication failures
- `HubSpotRateLimitError`: Rate limit exceeded
- `HubSpotValidationError`: Invalid data
- `HubSpotSyncError`: Sync failures

## Security Considerations

1. **Token Storage**: Encrypted at rest
2. **Webhook Validation**: Signature verification
3. **Data Privacy**: PII handling compliance
4. **Access Control**: Workspace isolation
5. **Audit Logging**: All operations logged

## Testing

### Unit Tests
- OAuth flow mocking
- API client with fixtures
- Sync logic validation
- Error handling scenarios

### Integration Tests
- Real API calls (test account)
- Webhook processing
- Rate limit handling
- Data consistency

## Monitoring

### Metrics
- Sync success rate
- API call volume
- Error rates by type
- Sync latency

### Alerts
- Authentication failures
- High error rates
- Sync delays
- Rate limit warnings