# Pipedrive Bulk Sync Documentation

## Overview

The Pipedrive Bulk Sync feature enables efficient importing of large datasets into Pipedrive CRM with smart chunking, rate limit awareness, and comprehensive error handling.

## Features

### 1. Smart Chunking & Batch Processing
- Automatically chunks large datasets into manageable batches
- Configurable batch sizes (10-100 records per batch)
- Concurrent processing with configurable concurrency levels
- Respects Pipedrive API rate limits and token budgets

### 2. Progress Tracking
- Real-time progress updates via Server-Sent Events
- Detailed progress for each entity type (persons, organizations, deals, activities)
- Estimated time remaining calculations
- Pause/resume functionality for long-running imports

### 3. Data Validation & Transformation
- Automatic field mapping with intelligent defaults
- Data type validation before import
- Custom field transformations
- Support for CSV, JSON, and Excel file formats

### 4. Duplicate Detection
- Smart duplicate detection based on key fields
- Configurable duplicate strategies:
  - Skip duplicates
  - Update existing records
  - Merge data with existing records

### 5. Error Recovery
- Automatic retry with exponential backoff
- Partial success handling
- Continue on error option
- Detailed error reporting

### 6. Sync Report Generation
- Comprehensive import reports in PDF or Markdown format
- Detailed statistics per entity type
- Error logs with actionable information
- Export functionality for further analysis

## Architecture

### Components

1. **BulkSyncService** (`bulk-sync.ts`)
   - Core sync engine
   - Handles chunking, rate limiting, and progress tracking
   - Manages sync state and checkpoints

2. **BulkSyncWizard** (`bulk-sync-wizard.tsx`)
   - Step-by-step import wizard UI
   - File upload and parsing
   - Field mapping interface
   - Options configuration

3. **BulkSyncManager** (`bulk-sync-manager.tsx`)
   - Dashboard for managing multiple sync operations
   - View active and historical imports
   - Download reports and logs

4. **FileParser** (`file-parser.ts`)
   - Handles CSV, JSON, and Excel parsing
   - Auto-detection of entity types
   - Field mapping and transformation

## Usage

### Starting a New Import

```typescript
import { BulkSyncService } from '@/lib/integrations/pipedrive/bulk-sync';
import { PipedriveClient } from '@/lib/integrations/pipedrive/client';

const client = new PipedriveClient(accessToken, companyDomain);
const bulkSync = new BulkSyncService(client);

const result = await bulkSync.startBulkSync(
  {
    persons: [...],
    organizations: [...],
    deals: [...],
    activities: [...]
  },
  {
    workspaceId: 'workspace-123',
    batchSize: 50,
    maxConcurrency: 5,
    validateData: true,
    detectDuplicates: true,
    continueOnError: true,
    progressCallback: (progress) => {
      console.log(`${progress.entityType}: ${progress.processed}/${progress.total}`);
    }
  }
);
```

### UI Components

```tsx
import { BulkSyncWizard } from '@/components/pipedrive/bulk-sync-wizard';
import { BulkSyncManager } from '@/components/pipedrive/bulk-sync-manager';

// Wizard for new imports
<BulkSyncWizard
  workspaceId={workspaceId}
  onComplete={(result) => console.log('Import completed', result)}
  onCancel={() => console.log('Import cancelled')}
/>

// Manager for viewing all imports
<BulkSyncManager workspaceId={workspaceId} />
```

## File Formats

### CSV Format
```csv
name,email,phone,company,job_title
John Doe,john@example.com,+1234567890,Acme Corp,CEO
Jane Smith,jane@example.com,+0987654321,Tech Inc,CTO
```

### JSON Format
```json
{
  "persons": [
    {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "organization": "Acme Corp"
    }
  ],
  "organizations": [
    {
      "name": "Acme Corp",
      "domain": "acme.com",
      "industry": "Technology"
    }
  ]
}
```

### Excel Format
- Sheet names determine entity type:
  - "Persons" or "Contacts" → persons
  - "Organizations" or "Companies" → organizations
  - "Deals" or "Opportunities" → deals
  - "Activities" or "Tasks" → activities

## API Endpoints

### Start Bulk Sync
```
POST /api/pipedrive/bulk-sync
{
  "data": {
    "persons": [...],
    "organizations": [...],
    "deals": [...],
    "activities": [...]
  },
  "options": {
    "workspaceId": "...",
    "batchSize": 50,
    "validateData": true,
    "detectDuplicates": true
  }
}
```

### Get Sync Jobs
```
GET /api/pipedrive/bulk-sync?workspaceId=xxx
```

### Sync Operations
```
POST /api/pipedrive/bulk-sync/{syncId}/pause
POST /api/pipedrive/bulk-sync/{syncId}/resume
POST /api/pipedrive/bulk-sync/{syncId}/cancel
POST /api/pipedrive/bulk-sync/{syncId}/retry
```

### Download Report
```
GET /api/pipedrive/bulk-sync/{syncId}/report?format=pdf
```

## Database Schema

```sql
CREATE TABLE pipedrive_sync_jobs (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  status VARCHAR(50) NOT NULL,
  source VARCHAR(50) NOT NULL,
  total_records INTEGER,
  processed_records INTEGER,
  successful_records INTEGER,
  failed_records INTEGER,
  duplicate_records INTEGER,
  options JSONB,
  result JSONB,
  error TEXT,
  created_by_id UUID NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Error Handling

### Common Errors

1. **Rate Limit Errors**
   - Automatic retry with exponential backoff
   - Respects X-RateLimit headers

2. **Token Budget Exceeded**
   - Pauses sync until budget resets
   - Shows remaining tokens and reset time

3. **Validation Errors**
   - Detailed field-level error messages
   - Option to skip invalid records

4. **Network Errors**
   - Automatic retry with configurable attempts
   - Resume from last checkpoint

## Best Practices

1. **Data Preparation**
   - Clean and validate data before import
   - Use consistent field naming
   - Remove duplicates in source data

2. **Batch Sizing**
   - Use smaller batches (25-50) for complex records
   - Larger batches (100) for simple records
   - Consider API token budget

3. **Error Handling**
   - Enable "Continue on Error" for large imports
   - Review error reports after completion
   - Fix data issues and retry failed records

4. **Performance**
   - Import during off-peak hours
   - Use reasonable concurrency levels (3-5)
   - Monitor token usage and rate limits

## Limitations

- Maximum 30,000 API tokens per day (Pipedrive limit)
- Burst limit of 100 requests per 2 seconds
- Maximum file size: 100MB
- Maximum records per import: 100,000

## Future Enhancements

1. **Scheduled Imports**
   - Recurring imports from external sources
   - Automatic sync from databases

2. **Advanced Mapping**
   - AI-powered field mapping suggestions
   - Custom transformation functions

3. **Webhooks**
   - Notify external systems on completion
   - Integration with workflow automation

4. **Data Quality**
   - Automatic data enrichment
   - Duplicate merging strategies
   - Data quality scoring