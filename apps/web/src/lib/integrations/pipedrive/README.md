# Pipedrive Reply Handler System

A comprehensive system for automatically detecting email replies, analyzing sentiment, and creating qualified leads in Pipedrive based on positive responses to cold outreach campaigns.

## Overview

This system provides:

1. **Email Reply Detection** - Automatically detects when prospects reply to campaign emails
2. **AI-Powered Sentiment Analysis** - Analyzes reply sentiment, intent, and qualification level using OpenAI/Anthropic
3. **Automatic Lead Creation** - Creates persons and deals in Pipedrive for qualified replies
4. **Activity Logging** - Tracks all email interactions and creates corresponding activities
5. **Lead Qualification Scoring** - Advanced scoring system based on multiple factors
6. **Configurable Rules** - Flexible configuration for auto-creation thresholds and behavior

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Email Reply   │───▶│  Reply Detection │───▶│ Sentiment       │
│   Received      │    │  Service         │    │ Analysis        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                        │
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Pipedrive     │◄───│  Reply Handler   │◄───│ Lead            │
│   Integration   │    │  Service         │    │ Qualification   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Key Components

### 1. Sentiment Analysis Service (`sentiment-analysis.ts`)

AI-powered analysis of email replies to determine:
- **Sentiment**: positive, neutral, negative
- **Intent**: interested, meeting_request, question, not_interested, etc.
- **Qualification Score**: 0-100 based on buying signals
- **Urgency Level**: low, medium, high
- **Key Phrases**: Important phrases that influenced analysis

```typescript
import { SentimentAnalysisService } from './sentiment-analysis';

const service = new SentimentAnalysisService({
  provider: 'openai',
  apiKey: process.env.AI_API_KEY,
});

const result = await service.analyzeReply({
  originalSubject: 'Partnership Opportunity',
  originalContent: 'Hi, I wanted to discuss...',
  replyContent: 'Thanks for reaching out! I\'d love to learn more.',
  senderEmail: 'prospect@example.com',
});
```

### 2. Reply Detection Service (`reply-detection.ts`)

Handles detection and processing of email replies:
- Identifies replies to campaign emails
- Stores reply data with sentiment analysis
- Updates lead engagement metrics
- Marks replies for further processing

```typescript
import { EmailReplyDetectionService } from './reply-detection';

const service = new EmailReplyDetectionService(workspaceId);

const result = await service.processReply({
  id: 'reply-123',
  fromEmail: 'prospect@example.com',
  subject: 'Re: Partnership Opportunity',
  content: 'I\'m interested in learning more',
  // ... other email data
});
```

### 3. Reply Handler Service (`reply-handler.ts`)

Main orchestration service that:
- Processes qualified replies
- Creates persons in Pipedrive
- Creates deals for high-value prospects
- Logs activities and sends notifications
- Handles batch processing

```typescript
import { PipedriveReplyHandlerService } from './reply-handler';

const handler = new PipedriveReplyHandlerService(workspaceId, {
  autoCreatePersons: true,
  autoCreateDeals: true,
  sentimentAnalysis: {
    enabled: true,
    minConfidenceThreshold: 0.7,
  },
  // ... other configuration
});

const result = await handler.processReply(replyData);
```

### 4. Lead Qualification Service (`qualification-utils.ts`)

Advanced lead scoring based on:
- Sentiment and intent analysis
- Lead data quality (company, title, etc.)
- Engagement history
- Company data (size, funding, industry)
- Urgency and confidence levels

```typescript
import { LeadQualificationService } from './qualification-utils';

const service = new LeadQualificationService(workspaceId);

const qualification = await service.calculateQualificationScore(
  sentimentResult,
  leadData
);

console.log(qualification.normalizedScore); // 0-100
console.log(qualification.tier); // 'cold' | 'warm' | 'hot' | 'qualified'
```

### 5. Email Tracking Integration (`email-tracking-integration.ts`)

Integrates with existing email tracking system:
- Processes email webhooks (opens, clicks, replies)
- Handles incoming email processing
- Updates engagement metrics
- Triggers Pipedrive processing for replies

## Configuration

### Basic Configuration

```typescript
import { PipedriveReplyHandlerConfig } from './reply-handler-types';

const config: PipedriveReplyHandlerConfig = {
  workspaceId: 'workspace-123',
  enabled: true,
  autoCreatePersons: true,
  autoCreateDeals: false,
  autoLogActivities: true,
  
  sentimentAnalysis: {
    enabled: true,
    provider: 'openai',
    minConfidenceThreshold: 0.7,
  },
  
  creationRules: {
    persons: {
      enabled: true,
      conditions: {
        sentiments: ['positive', 'neutral'],
        intents: ['interested', 'meeting_request', 'question'],
        minConfidence: 0.6,
        minQualificationScore: 40,
      },
      skipExisting: true,
      updateExisting: true,
      enrichmentLevel: 'basic',
    },
    // ... other rules
  },
  
  qualificationThresholds: {
    minQualificationScore: 30,
    highValueThreshold: 80,
  },
};
```

### Configuration Presets

Use pre-built configurations for common scenarios:

```typescript
import { CONFIGURATION_PRESETS, getConfigurationPreset } from './index';

// Conservative: Only highly qualified leads
const conservativeConfig = getConfigurationPreset('conservative');

// Balanced: Good mix of automation and control
const balancedConfig = getConfigurationPreset('balanced');

// Aggressive: Maximum automation and lead capture
const aggressiveConfig = getConfigurationPreset('aggressive');
```

## Usage Examples

### 1. Basic Setup

```typescript
import { 
  setupReplyHandler, 
  DEFAULT_REPLY_HANDLER_CONFIG 
} from '@/lib/integrations/pipedrive';

// Setup with default configuration
const { replyHandler } = await setupReplyHandler(
  workspaceId, 
  DEFAULT_REPLY_HANDLER_CONFIG
);

// Process incoming replies
const result = await replyHandler.processReply(emailReplyData);
```

### 2. Custom Configuration

```typescript
import { createPipedriveReplyHandler } from '@/lib/integrations/pipedrive';

const handler = createPipedriveReplyHandler(workspaceId, {
  autoCreatePersons: true,
  autoCreateDeals: true,
  
  creationRules: {
    persons: {
      enabled: true,
      conditions: {
        sentiments: ['positive'],
        intents: ['interested', 'meeting_request'],
        minConfidence: 0.8,
        minQualificationScore: 60,
      },
    },
    deals: {
      enabled: true,
      conditions: {
        sentiments: ['positive'],
        intents: ['interested', 'meeting_request'],
        minConfidence: 0.7,
        minQualificationScore: 70,
        requireExistingPerson: true,
      },
      valueCalculation: {
        method: 'score_based',
        baseValue: 5000,
      },
    },
  },
});
```

### 3. Batch Processing

```typescript
import { processPendingReplies } from '@/lib/integrations/pipedrive';

// Process all pending replies
const batchResult = await processPendingReplies(workspaceId, 100);

console.log(`Processed ${batchResult.totalProcessed} replies`);
console.log(`Created ${batchResult.summary.personsCreated} persons`);
console.log(`Created ${batchResult.summary.dealsCreated} deals`);
```

### 4. Webhook Integration

```typescript
import { handleWebhookEvent } from '@/lib/integrations/pipedrive';

// Handle email webhook
app.post('/webhook/email', async (req, res) => {
  const result = await handleWebhookEvent(workspaceId, {
    type: 'email',
    payload: req.body,
  });
  
  res.json(result);
});

// Handle incoming email
app.post('/webhook/incoming-email', async (req, res) => {
  const result = await handleWebhookEvent(workspaceId, {
    type: 'incoming_email',
    payload: req.body,
  });
  
  res.json(result);
});
```

### 5. Statistics and Monitoring

```typescript
import { 
  getReplyHandlerStats, 
  getQualificationBenchmarks 
} from '@/lib/integrations/pipedrive';

// Get email tracking statistics
const emailStats = await getReplyHandlerStats(workspaceId, 30);
console.log(`Reply rate: ${emailStats.replyRate}%`);

// Get qualification benchmarks
const benchmarks = await getQualificationBenchmarks(workspaceId);
console.log(`Average qualification score: ${benchmarks.averageScore}`);
```

## Database Schema

The system requires several database tables:

### Email Replies
```sql
CREATE TABLE email_replies (
  id TEXT PRIMARY KEY,
  workspace_id UUID NOT NULL,
  original_email_id UUID,
  campaign_id UUID,
  lead_id UUID,
  from_email TEXT NOT NULL,
  from_name TEXT,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  sentiment TEXT,
  intent TEXT,
  qualification_score INTEGER,
  sentiment_confidence DECIMAL,
  urgency TEXT,
  key_phrases TEXT[],
  received_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  pipedrive_processed_at TIMESTAMPTZ
);
```

### Reply Handler Settings
```sql
CREATE TABLE pipedrive_reply_handler_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  config JSONB NOT NULL,
  enabled BOOLEAN DEFAULT true,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  version INTEGER DEFAULT 1
);
```

## API Endpoints

### Process Reply
```typescript
POST /api/pipedrive/process-reply
{
  "replyData": {
    "id": "reply-123",
    "fromEmail": "prospect@example.com",
    "subject": "Re: Partnership",
    "content": "I'm interested!",
    // ... other fields
  }
}
```

### Batch Process
```typescript
POST /api/pipedrive/batch-process
{
  "limit": 50
}
```

### Update Configuration
```typescript
PUT /api/pipedrive/config
{
  "config": {
    "autoCreatePersons": true,
    // ... configuration
  }
}
```

## Error Handling

The system includes comprehensive error handling:

```typescript
import { handleReplyProcessingError } from '@/lib/integrations/pipedrive';

try {
  const result = await handler.processReply(replyData);
} catch (error) {
  const errorInfo = handleReplyProcessingError(error);
  
  switch (errorInfo.type) {
    case 'auth_error':
      // Handle authentication issues
      break;
    case 'rate_limit_error':
      // Handle rate limiting
      break;
    case 'reply_handler_error':
      // Handle specific reply handler errors
      break;
  }
}
```

## Monitoring and Analytics

### Key Metrics
- Reply processing rate
- Sentiment analysis accuracy
- Lead qualification scores
- Conversion rates by tier
- Pipedrive creation success rates

### Performance Optimization
- Batch processing for high volume
- Rate limiting compliance
- Caching for repeated operations
- Error retry mechanisms

## Security Considerations

1. **API Key Protection**: Store AI and Pipedrive API keys securely
2. **Data Privacy**: Handle email content according to GDPR requirements
3. **Access Control**: Workspace-level isolation for all operations
4. **Audit Logging**: Track all automated actions for compliance

## Testing

```typescript
import { PipedriveReplyHandlerService } from './reply-handler';

// Test the system
const handler = new PipedriveReplyHandlerService(workspaceId, config);
const testResult = await handler.testReplyHandler();

if (testResult.success) {
  console.log('All systems operational');
} else {
  console.error('Test failed:', testResult.error);
}
```

## Deployment

1. Configure environment variables:
   ```env
   AI_PROVIDER=openai
   AI_API_KEY=your_openai_key
   PIPEDRIVE_CLIENT_ID=your_client_id
   PIPEDRIVE_CLIENT_SECRET=your_client_secret
   ```

2. Set up database tables (run migrations)

3. Configure webhooks for email tracking

4. Enable integration in workspace settings

## Troubleshooting

### Common Issues

1. **Sentiment analysis failing**: Check AI API key and model availability
2. **Pipedrive creation errors**: Verify API permissions and field requirements
3. **Reply detection not working**: Check email tracking integration and message ID matching
4. **Rate limiting**: Implement proper delays and respect API limits

### Debug Mode

Enable detailed logging:

```typescript
const handler = new PipedriveReplyHandlerService(workspaceId, {
  ...config,
  debug: true,
});
```

## Future Enhancements

1. **Advanced Enrichment**: Integration with Clearbit, ZoomInfo, etc.
2. **Machine Learning**: Custom models for industry-specific qualification
3. **A/B Testing**: Test different qualification thresholds
4. **Real-time Notifications**: Slack/Teams integration for high-value leads
5. **Advanced Analytics**: Conversion tracking and ROI analysis

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review error logs and error handling
3. Test individual components in isolation
4. Verify API credentials and permissions