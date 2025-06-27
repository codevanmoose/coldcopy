# GDPR Compliance Service

A comprehensive GDPR compliance service for managing consent, data subject rights, cookie management, and compliance tracking.

## Features

### 1. Consent Management
- Record and track consent for different purposes
- Check consent status before processing
- Handle consent withdrawal
- Manage consent versions and updates
- Consent proof generation with digital signatures

### 2. Data Subject Rights
- Handle access requests (Article 15)
- Process rectification requests (Article 16)
- Execute erasure requests / right to be forgotten (Article 17)
- Manage data portability (Article 20)
- Handle restriction requests (Article 18)
- Process objection requests (Article 21)

### 3. Cookie Management
- Cookie consent recording and tracking
- Granular cookie preferences (necessary, functional, analytics, marketing)
- Cookie consent withdrawal
- Version management for cookie policies

### 4. Data Export
- Export all personal data in machine-readable formats (JSON, CSV, XML)
- Include all related data (emails, events, enrichment, etc.)
- Secure download links with expiration
- Checksum verification for data integrity

### 5. Data Deletion
- Multiple deletion strategies (hard delete, soft delete, anonymization)
- Cascade deletion of personal data
- Retention policy enforcement
- Deletion verification and audit trails

### 6. Compliance Tracking
- Comprehensive audit logging for all operations
- Consent proof generation
- Compliance reports (consent, requests, audit logs, processing activities)
- Policy version management
- GDPR metrics and analytics

## Usage

### Basic Setup

```typescript
import { gdprService } from '@/lib/gdpr'

// The service uses the default Supabase client
// You can also instantiate with a custom client:
// const gdpr = new GdprService(customSupabaseClient)
```

### Recording Consent

```typescript
import { ConsentType, ConsentStatus, ConsentMethod } from '@/lib/gdpr'

// Record marketing consent
const consent = await gdprService.recordConsent({
  workspaceId: 'workspace-id',
  leadId: 'lead-id',
  consentType: ConsentType.MARKETING,
  status: ConsentStatus.GRANTED,
  method: ConsentMethod.EXPLICIT,
  version: '1.0',
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0...',
  consentText: 'I agree to receive marketing communications',
  source: 'signup_form',
  expiresDays: 365
})
```

### Checking Consent

```typescript
// Check multiple consent types
const consentStatus = await gdprService.checkConsent({
  workspaceId: 'workspace-id',
  leadId: 'lead-id',
  consentTypes: [ConsentType.MARKETING, ConsentType.TRACKING]
})

// Result:
// {
//   consents: {
//     marketing: { granted: true, version: '1.0', grantedAt: Date },
//     tracking: { granted: false }
//   }
// }
```

### Handling Data Subject Requests

```typescript
import { DataSubjectRequestType } from '@/lib/gdpr'

// Create an access request
const request = await gdprService.createDataSubjectRequest({
  workspaceId: 'workspace-id',
  requestType: DataSubjectRequestType.ACCESS,
  requesterEmail: 'user@example.com',
  requesterName: 'John Doe',
  leadId: 'lead-id'
})

// Verify the request (user clicks verification link)
await gdprService.verifyDataSubjectRequest({
  requestId: request.id,
  verificationToken: request.verificationToken
})
```

### Exporting Data

```typescript
import { ResponseFormat } from '@/lib/gdpr'

// Export lead data in JSON format
const exportResult = await gdprService.exportData({
  workspaceId: 'workspace-id',
  leadId: 'lead-id',
  format: ResponseFormat.JSON,
  includeTypes: ['leads', 'consent', 'emails', 'events']
})

// Result includes a secure download URL
console.log(exportResult.downloadUrl)
```

### Deleting Data

```typescript
import { DeletionStrategy } from '@/lib/gdpr'

// Delete with anonymization
const deletion = await gdprService.deleteData({
  workspaceId: 'workspace-id',
  leadId: 'lead-id',
  deletionStrategy: DeletionStrategy.ANONYMIZE,
  reason: 'User requested deletion',
  notifyUser: true
})
```

### Cookie Consent Management

```typescript
// Record cookie consent
const cookieConsent = await gdprService.recordCookieConsent({
  workspaceId: 'workspace-id',
  visitorId: 'visitor-123',
  necessary: true,
  functional: true,
  analytics: false,
  marketing: false,
  version: '1.0',
  ipAddress: '192.168.1.1'
})

// Get cookie consent
const consent = await gdprService.getCookieConsent(
  'workspace-id',
  'visitor-123'
)
```

### Generating Compliance Reports

```typescript
// Generate a full compliance report
const report = await gdprService.generateComplianceReport({
  workspaceId: 'workspace-id',
  reportType: 'full',
  dateRange: {
    start: new Date('2024-01-01'),
    end: new Date('2024-12-31')
  },
  format: ResponseFormat.PDF
})
```

### Getting GDPR Metrics

```typescript
// Get comprehensive GDPR metrics
const metrics = await gdprService.getGdprMetrics('workspace-id')

// Metrics include:
// - Consent statistics
// - Data subject request metrics
// - Suppression list data
// - Retention policy information
```

## Utility Functions

### Data Anonymization

```typescript
import { 
  anonymizeEmail, 
  anonymizePhone, 
  anonymizeName,
  anonymizeCustomFields 
} from '@/lib/gdpr'

// Anonymize email (preserves domain)
anonymizeEmail('john@example.com') // 'anon-a1b2c3d4@example.com'

// Anonymize phone
anonymizePhone('+1234567890') // '+1XXXXXX7890'

// Anonymize name
anonymizeName('John Doe') // 'User_A1B2C3'

// Anonymize custom fields
anonymizeCustomFields({
  email: 'john@example.com',
  phone: '+1234567890',
  address: '123 Main St'
})
// {
//   email: 'anon-a1b2c3d4@example.com',
//   phone: '+1XXXXXX7890',
//   address: 'REDACTED_LOCATION'
// }
```

### Error Handling

```typescript
import { createGdprError, GdprErrorCode } from '@/lib/gdpr'

try {
  await gdprService.recordConsent(request)
} catch (error) {
  if (error.code === GdprErrorCode.CONSENT_EXPIRED) {
    // Handle expired consent
  } else if (error.code === GdprErrorCode.INVALID_CONSENT_TYPE) {
    // Handle invalid consent type
  }
}
```

## Database Schema

The service relies on the following main tables:
- `consent_records` - Stores all consent records
- `data_subject_requests` - Manages GDPR requests
- `privacy_policies` - Version control for policies
- `data_retention_policies` - Retention rules
- `gdpr_audit_logs` - Comprehensive audit trail
- `cookie_consents` - Cookie consent tracking
- `suppression_list` - Email suppression management

See migration `016_gdpr_compliance_schema.sql` for complete schema.

## Email Templates

The service includes pre-built email templates for:
- Consent requests and confirmations
- Data request notifications
- Verification emails
- Export ready notifications
- Deletion confirmations
- Privacy policy updates
- Unsubscribe confirmations

## Security Considerations

1. **Verification**: All data subject requests require email verification
2. **Encryption**: Export files should be encrypted in production
3. **Access Control**: Uses Row Level Security (RLS) policies
4. **Audit Trail**: All actions are logged for compliance
5. **Data Minimization**: Only necessary data is collected and retained

## Compliance Features

- **Article 6**: Legal basis tracking for all processing
- **Article 7**: Consent management with withdrawal capability
- **Article 12-22**: Full data subject rights implementation
- **Article 25**: Privacy by design principles
- **Article 30**: Processing activities register
- **Article 32**: Security measures and audit logging
- **Article 33-34**: Breach notification support

## Best Practices

1. Always verify consent before processing personal data
2. Implement retention policies for all data types
3. Regularly review and update privacy policies
4. Monitor GDPR metrics and respond to requests promptly
5. Keep audit logs for at least 2 years
6. Test data export and deletion processes regularly
7. Train staff on GDPR compliance procedures

## Environment Variables

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Optional (with defaults)
GDPR_HASH_SALT=your-hash-salt
GDPR_SIGNATURE_SECRET=your-signature-secret
GDPR_DOWNLOAD_SECRET=your-download-secret
SUPPORT_EMAIL=support@example.com
NEXT_PUBLIC_APP_URL=https://your-app.com
```

## Testing

```typescript
// Test consent flow
const consent = await gdprService.recordConsent({...})
const status = await gdprService.checkConsent({...})
await gdprService.withdrawConsent(...)

// Test data export
const exportResult = await gdprService.exportData({...})
// Verify download link works

// Test deletion
const deletion = await gdprService.deleteData({...})
// Verify data is anonymized/deleted
```

## Troubleshooting

### Common Issues

1. **Verification emails not sending**: Check email service configuration
2. **Export fails**: Ensure sufficient storage and proper permissions
3. **Deletion blocked**: Check for active subscriptions or legal holds
4. **Consent not recording**: Verify consent type is valid

### Debug Mode

Enable detailed logging:

```typescript
// In development, audit logs include more details
const auditLogs = await gdprService.getAuditLogs(
  workspaceId,
  { start: new Date('2024-01-01'), end: new Date() }
)
```

## Support

For questions or issues:
1. Check the error codes and messages
2. Review audit logs for detailed information
3. Ensure database migrations are up to date
4. Contact support with request IDs for investigation