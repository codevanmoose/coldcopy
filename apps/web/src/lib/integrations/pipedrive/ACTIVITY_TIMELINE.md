# Pipedrive Activity Timeline Sync System

## Overview

The Activity Timeline Sync System provides comprehensive email history synchronization between ColdCopy and Pipedrive, with timeline reconstruction, real-time updates, and advanced analytics.

## Features

### 1. Complete Email History Synchronization
- **Full Historical Import**: Sync all past email interactions to Pipedrive
- **Email Event Tracking**: Track sent, opened, clicked, replied, bounced events
- **Thread Analysis**: Maintain conversation context and relationships
- **Metadata Preservation**: Keep campaign, sequence, and engagement data

### 2. Timeline Reconstruction
- **Chronological Ordering**: Activities displayed in correct time sequence
- **Activity Categorization**: Email, call, meeting, task, note, social
- **Sub-type Classification**: Detailed activity types (e.g., email_opened, call_missed)
- **Participant Tracking**: Track all people involved in activities

### 3. Real-time Activity Streaming
- **Live Updates**: Activities appear in real-time as they occur
- **WebSocket Support**: Low-latency updates via Supabase Realtime
- **Selective Filtering**: Stream only relevant activities
- **Error Handling**: Automatic reconnection and retry logic

### 4. Activity Type Mapping
- **Flexible Categorization**: Map ColdCopy events to Pipedrive activity types
- **Custom Activity Types**: Support for custom Pipedrive activity types
- **Template System**: Pre-defined templates for common activities
- **Field Mapping**: Map custom fields between systems

### 5. Bulk Historical Sync
- **Batch Processing**: Efficient sync of large activity volumes
- **Progress Tracking**: Real-time sync progress with ETA
- **Error Recovery**: Automatic retry for failed activities
- **Selective Sync**: Filter by date range, campaign, or lead

### 6. Email Thread Analysis
- **Conversation Tracking**: Group related emails into threads
- **Sentiment Analysis**: Analyze conversation sentiment
- **Engagement Scoring**: Calculate engagement levels
- **Intent Detection**: Identify buying intent signals

### 7. Engagement Analytics
- **Activity Metrics**: Track activity volume and frequency
- **Engagement Trends**: Visualize engagement over time
- **Category Breakdown**: Analyze activity distribution
- **Performance Insights**: Identify high-performing activities

### 8. Activity Template Management
- **Custom Templates**: Create reusable activity templates
- **Field Interpolation**: Dynamic field values in templates
- **Category-specific**: Templates for each activity type
- **Quick Creation**: One-click activity creation from templates

## Architecture

### Database Schema

```sql
-- Main activity timeline table
activity_timeline (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  lead_id UUID,
  campaign_id UUID,
  pipedrive_activity_id INTEGER,
  category VARCHAR(50),
  sub_type VARCHAR(50),
  subject TEXT,
  description TEXT,
  timestamp TIMESTAMP,
  duration INTEGER,
  participants JSONB,
  metadata JSONB,
  synced BOOLEAN,
  synced_at TIMESTAMP
)

-- Activity templates
activity_templates (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  name VARCHAR(255),
  category VARCHAR(50),
  default_subject TEXT,
  default_description TEXT,
  fields JSONB
)

-- Sync queue for batch processing
activity_sync_queue (
  id UUID PRIMARY KEY,
  activity_id UUID,
  priority INTEGER,
  status VARCHAR(50),
  attempts INTEGER
)

-- Email thread analysis
email_thread_analysis (
  id UUID PRIMARY KEY,
  thread_id UUID,
  sentiment VARCHAR(20),
  engagement_score INTEGER,
  intent_level VARCHAR(20)
)

-- Engagement metrics
activity_engagement_metrics (
  id UUID PRIMARY KEY,
  lead_id UUID,
  date DATE,
  total_activities INTEGER,
  engagement_score INTEGER
)
```

### Service Architecture

```typescript
ActivityTimelineService
├── Timeline Operations
│   ├── getLeadTimeline()
│   ├── getEmailThreads()
│   └── calculateTimelineSummary()
├── Sync Operations
│   ├── syncEmailHistory()
│   ├── processBatch()
│   └── getSyncProgress()
├── Real-time Operations
│   ├── streamActivities()
│   └── subscribeToUpdates()
├── Template Operations
│   ├── getActivityTemplates()
│   └── createActivityFromTemplate()
└── Analytics Operations
    ├── getEngagementAnalytics()
    └── calculateEngagementScore()
```

## Usage

### Basic Timeline Retrieval

```typescript
import { ActivityTimelineService } from '@/lib/integrations/pipedrive/activity-timeline';

const service = new ActivityTimelineService(workspaceId);

// Get complete timeline for a lead
const timeline = await service.getLeadTimeline(leadId, {
  startDate: new Date('2024-01-01'),
  endDate: new Date(),
  categories: [ActivityCategory.EMAIL, ActivityCategory.CALL],
  includeEmailThreads: true,
  limit: 100
});

console.log(timeline.activities); // Array of timeline activities
console.log(timeline.threads); // Email conversation threads
console.log(timeline.summary); // Engagement summary statistics
```

### Bulk Historical Sync

```typescript
// Sync all email history
await service.syncEmailHistory({
  startDate: new Date('2023-01-01'),
  endDate: new Date(),
  categories: [ActivityCategory.EMAIL],
  batchSize: 50,
  includeHistorical: true,
  syncDirection: 'to_pipedrive',
  conflictResolution: 'skip'
});

// Monitor sync progress
const progress = service.getSyncProgress();
console.log(`Progress: ${progress.syncedActivities}/${progress.totalActivities}`);
```

### Real-time Activity Streaming

```typescript
// Stream activities for a specific lead
const unsubscribe = await service.streamActivities({
  leadId: 'lead-123',
  categories: [ActivityCategory.EMAIL, ActivityCategory.CALL],
  onActivity: (activity) => {
    console.log('New activity:', activity);
    // Update UI with new activity
  },
  onError: (error) => {
    console.error('Stream error:', error);
  }
});

// Later: stop streaming
unsubscribe();
```

### Using Activity Templates

```typescript
// Get available templates
const templates = await service.getActivityTemplates(ActivityCategory.CALL);

// Create activity from template
const activity = await service.createActivityFromTemplate(templateId, {
  leadId: 'lead-123',
  personId: 456,
  fieldValues: {
    duration: 30,
    outcome: 'Interested',
    nextSteps: 'Schedule demo'
  }
});
```

### Engagement Analytics

```typescript
// Get engagement analytics
const analytics = await service.getEngagementAnalytics({
  leadId: 'lead-123',
  startDate: new Date('2024-01-01'),
  endDate: new Date(),
  groupBy: 'week'
});

console.log(analytics.timeline); // Weekly activity breakdown
console.log(analytics.summary); // Overall engagement metrics
```

## React Hook Usage

```typescript
import { useActivityTimeline } from '@/hooks/use-activity-timeline';

function LeadTimeline({ leadId }) {
  const {
    activities,
    threads,
    summary,
    isLoading,
    syncing,
    syncProgress,
    startSync,
    refetch
  } = useActivityTimeline({
    leadId,
    includeThreads: true,
    limit: 50
  });

  if (isLoading) return <Skeleton />;

  return (
    <div>
      <Button onClick={() => startSync({ includeHistorical: true })}>
        Sync History
      </Button>
      
      {syncing && (
        <Progress value={syncProgress.percentComplete} />
      )}
      
      <ActivityTimelineView
        activities={activities}
        threads={threads}
        summary={summary}
      />
    </div>
  );
}
```

## API Endpoints

### GET /api/pipedrive/activity-timeline
Get timeline activities with filtering options.

### POST /api/pipedrive/activity-timeline
Create new activity from template.

### POST /api/pipedrive/activity-timeline/sync
Start bulk sync operation.

### GET /api/pipedrive/activity-timeline/sync/progress
Get current sync progress.

### GET /api/pipedrive/activity-timeline/analytics
Get engagement analytics data.

## Configuration

### Sync Configuration

```typescript
interface BulkSyncOptions {
  startDate?: Date;
  endDate?: Date;
  categories?: ActivityCategory[];
  leadIds?: string[];
  campaignIds?: string[];
  batchSize?: number; // Default: 50
  includeHistorical?: boolean; // Default: false
  syncDirection?: 'to_pipedrive' | 'from_pipedrive' | 'bidirectional';
  conflictResolution?: 'skip' | 'overwrite' | 'merge';
}
```

### Activity Categories

```typescript
enum ActivityCategory {
  EMAIL = 'email',
  CALL = 'call',
  MEETING = 'meeting',
  TASK = 'task',
  NOTE = 'note',
  LINKEDIN = 'linkedin',
  SMS = 'sms',
  WHATSAPP = 'whatsapp'
}
```

### Activity Sub-types

```typescript
enum ActivitySubType {
  // Email
  EMAIL_SENT = 'email_sent',
  EMAIL_OPENED = 'email_opened',
  EMAIL_CLICKED = 'email_clicked',
  EMAIL_REPLIED = 'email_replied',
  EMAIL_BOUNCED = 'email_bounced',
  
  // Call
  CALL_OUTBOUND = 'call_outbound',
  CALL_INBOUND = 'call_inbound',
  CALL_MISSED = 'call_missed',
  
  // Meeting
  MEETING_SCHEDULED = 'meeting_scheduled',
  MEETING_COMPLETED = 'meeting_completed',
  MEETING_CANCELLED = 'meeting_cancelled'
}
```

## Performance Considerations

1. **Batch Processing**: Activities are synced in configurable batches to avoid API limits
2. **Rate Limiting**: Automatic rate limit handling with exponential backoff
3. **Caching**: Timeline data is cached to reduce API calls
4. **Indexing**: Database indexes on commonly queried fields
5. **Pagination**: Support for paginated results to handle large datasets

## Error Handling

The system includes comprehensive error handling:

- **Network Errors**: Automatic retry with exponential backoff
- **Rate Limits**: Pause and resume when rate limited
- **Validation Errors**: Clear error messages for invalid data
- **Sync Conflicts**: Configurable conflict resolution strategies
- **Partial Failures**: Continue processing on individual failures

## Security

- **Workspace Isolation**: All data is isolated by workspace
- **RLS Policies**: Row-level security on all tables
- **Token Encryption**: API tokens encrypted at rest
- **Audit Logging**: All sync operations are logged
- **Permission Checks**: Role-based access control

## Troubleshooting

### Common Issues

1. **Sync Not Starting**
   - Check Pipedrive integration is connected
   - Verify user has admin permissions
   - Check for rate limit errors

2. **Missing Activities**
   - Ensure date range covers activity period
   - Check activity category filters
   - Verify lead/campaign associations

3. **Slow Performance**
   - Reduce batch size for large syncs
   - Use date filters to limit scope
   - Check database indexes are created

4. **Real-time Updates Not Working**
   - Verify WebSocket connection
   - Check browser console for errors
   - Ensure proper authentication

## Future Enhancements

1. **Advanced Analytics**
   - ML-based engagement predictions
   - Anomaly detection for unusual activity
   - Cohort analysis capabilities

2. **Enhanced Thread Analysis**
   - Topic extraction from conversations
   - Automated response suggestions
   - Thread summarization

3. **Multi-channel Support**
   - WhatsApp Business API integration
   - LinkedIn Sales Navigator sync
   - SMS campaign tracking

4. **Workflow Automation**
   - Trigger-based activity creation
   - Automated follow-up scheduling
   - Smart activity assignments