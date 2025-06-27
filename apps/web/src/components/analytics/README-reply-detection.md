# Reply Detection Dashboard

## Overview

The Reply Detection Dashboard is a comprehensive analytics component that provides real-time insights into email reply patterns, helping users understand response rates, identify auto-replies, and track email engagement quality.

## Features

### 1. Reply Detection Metrics
- **Total Emails Processed**: Count of all emails analyzed
- **Reply Rate**: Percentage of emails that received any type of reply
- **Genuine Reply Rate**: Percentage of actual human responses
- **Auto-Reply Rate**: Percentage of automated responses detected
- **Bounce Rate**: Percentage of emails that bounced

### 2. Real-time Updates
The dashboard subscribes to Supabase real-time events and automatically updates when new replies are detected.

### 3. Advanced Filtering
- **Date Range**: Filter replies by custom date ranges
- **Reply Type**: Filter by genuine reply, auto-reply, bounce, or out-of-office
- **Reply Score**: Filter by minimum reply quality score (0-100)
- **Campaign**: Filter by specific campaigns
- **Search**: Search by lead name or email

### 4. Reply Trends Chart
Visual representation of reply patterns over time, showing:
- Genuine replies
- Auto-replies
- Bounces
- Out-of-office replies

### 5. Reply Score Distribution
Bar chart showing the distribution of reply quality scores across different ranges.

### 6. Recent Replies Table
Detailed list of recent replies with:
- Lead information (name and email)
- Email subject
- Reply type with visual indicators
- Reply score (color-coded)
- Campaign name
- Timestamp
- Quick actions to view thread or lead details

## Database Requirements

The component requires the following Supabase functions (included in migration 010_reply_detection_functions.sql):

1. `get_reply_detection_metrics()` - Returns overall reply metrics
2. `get_reply_trends()` - Returns daily reply counts by type
3. `get_reply_score_distribution()` - Returns reply score distribution data

## Reply Types

The system classifies replies into four categories:

1. **Genuine Reply** (green): Actual human responses
2. **Auto-Reply** (yellow): Automated responses (vacation, acknowledgment)
3. **Bounce** (red): Email delivery failures
4. **Out of Office** (blue): Temporary absence notifications

## Reply Scoring

Each reply is assigned a quality score from 0-100:
- **80-100**: High-quality, engaged response (green)
- **60-79**: Good response quality (yellow)
- **40-59**: Average response quality (orange)
- **0-39**: Low quality or minimal response (red)

## Integration

The component is integrated into the main Analytics page as a dedicated tab. To use it standalone:

```tsx
import { ReplyDetectionDashboard } from '@/components/analytics/reply-detection-dashboard'

// In your component
<ReplyDetectionDashboard workspaceId={workspaceId} />
```

## Data Structure

The component expects email events with the following metadata structure:

```typescript
{
  event_type: 'replied',
  metadata: {
    reply_type: 'genuine_reply' | 'auto_reply' | 'bounce' | 'out_of_office',
    reply_score: number, // 0-100
    thread_id?: string
  }
}
```

## Performance Considerations

- Uses database indexes on reply_type and reply_score for fast filtering
- Limits recent replies to 100 most recent entries
- Implements query caching with React Query
- Real-time updates are throttled to prevent excessive re-renders

## Future Enhancements

1. Export functionality for reply data
2. Reply sentiment analysis integration
3. Reply template detection
4. Lead scoring based on reply quality
5. Automated follow-up suggestions based on reply type