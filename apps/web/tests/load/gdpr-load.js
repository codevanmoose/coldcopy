/**
 * GDPR Operations Load Tests for ColdCopy
 * 
 * Tests the performance of GDPR compliance operations including:
 * - Data export performance
 * - Consent checking performance
 * - Large dataset deletion
 * - Audit log performance
 * - Data anonymization
 * - Right to be forgotten processing
 */

import { check, sleep } from 'k6';
import http from 'k6/http';
import { Rate, Trend, Counter } from 'k6/metrics';
import {
  BASE_URL,
  LOAD_TEST_STAGES,
  PERFORMANCE_THRESHOLDS,
  TestData,
  authenticate,
  getAuthHeaders,
  checkResponse,
  thinkTime,
  PerformanceMonitor,
  getTestConfig,
  setup,
  teardown,
} from './k6-config.js';

// GDPR-specific metrics
const gdprProcessingTime = new Trend('gdpr_processing_duration');
const dataExportTime = new Trend('data_export_duration');
const dataDeletionTime = new Trend('data_deletion_duration');
const consentCheckTime = new Trend('consent_check_duration');
const auditLogTime = new Trend('audit_log_duration');
const gdprRequestSuccessRate = new Rate('gdpr_request_success_rate');
const dataPrivacyComplianceRate = new Rate('data_privacy_compliance_rate');
const consentValidityRate = new Rate('consent_validity_rate');
const anonymizationEffectiveness = new Rate('anonymization_effectiveness');
const concurrentGdprOps = new Counter('concurrent_gdpr_operations');
const dataVolumeProcessed = new Counter('gdpr_data_volume_processed');
const retentionPolicyExecutions = new Counter('retention_policy_executions');

// Test configuration
export let options = {
  ...getTestConfig('moderate'),
  scenarios: {
    // Data export requests
    data_export_requests: {
      executor: 'ramping-vus',
      stages: LOAD_TEST_STAGES.light,
      exec: 'dataExportTest',
      tags: { test_type: 'data_export' },
    },
    
    // Consent management
    consent_management: {
      executor: 'constant-vus',
      vus: 20,
      duration: '8m',
      exec: 'consentManagementTest',
      tags: { test_type: 'consent' },
    },
    
    // Data deletion requests
    data_deletion: {
      executor: 'ramping-vus',
      stages: LOAD_TEST_STAGES.light,
      exec: 'dataDeletionTest',
      tags: { test_type: 'data_deletion' },
    },
    
    // Audit logging performance
    audit_logging: {
      executor: 'constant-arrival-rate',
      rate: 50,
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 30,
      exec: 'auditLoggingTest',
      tags: { test_type: 'audit_logging' },
    },
    
    // Privacy compliance checks
    privacy_compliance: {
      executor: 'constant-vus',
      vus: 15,
      duration: '10m',
      exec: 'privacyComplianceTest',
      tags: { test_type: 'privacy_compliance' },
    },
    
    // Data retention policy execution
    data_retention: {
      executor: 'ramping-vus',
      stages: LOAD_TEST_STAGES.light,
      exec: 'dataRetentionTest',
      tags: { test_type: 'data_retention' },
    }
  },
  
  thresholds: {
    ...PERFORMANCE_THRESHOLDS,
    gdpr_processing_duration: ['p(95)<10000'], // GDPR ops under 10s
    data_export_duration: ['p(95)<30000'], // Exports under 30s
    data_deletion_duration: ['p(95)<15000'], // Deletions under 15s
    consent_check_duration: ['p(95)<500'], // Consent checks under 500ms
    gdpr_request_success_rate: ['rate>0.95'], // 95% success rate
    data_privacy_compliance_rate: ['rate>0.98'], // 98% compliance
  }
};

export { setup, teardown };

/**
 * Data Export Test
 * Tests performance of data export requests (GDPR Article 20)
 */
export function dataExportTest() {
  const token = authenticate();
  const headers = getAuthHeaders(token);
  
  concurrentGdprOps.add(1);
  
  // Create data export request
  const exportRequest = {
    email: TestData.randomEmail(),
    data_types: ['personal_data', 'email_history', 'campaign_interactions', 'consent_records'],
    format: Math.random() > 0.5 ? 'json' : 'csv',
    include_metadata: true,
    date_range: {
      from: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), // Last year
      to: new Date().toISOString(),
    }
  };
  
  const startTime = Date.now();
  
  const requestResponse = http.post(
    `${BASE_URL}/api/gdpr/export`,
    JSON.stringify(exportRequest),
    {
      headers,
      tags: { 
        operation: 'data_export_request',
        format: exportRequest.format 
      }
    }
  );
  
  const requestDuration = Date.now() - startTime;
  
  gdprProcessingTime.add(requestDuration, { operation: 'export_request' });
  PerformanceMonitor.trackApiOperation('gdpr/export', requestDuration, requestResponse.status);
  
  const requestSuccess = checkResponse(requestResponse, 202, {
    operation: 'data_export_request',
    endpoint: 'gdpr'
  });
  
  gdprRequestSuccessRate.add(requestSuccess);
  
  if (requestSuccess) {
    const exportId = requestResponse.json('export_id');
    
    check(requestResponse, {
      'Export request accepted': () => exportId !== undefined,
      'Estimated time provided': (r) => r.json('estimated_completion_time') !== undefined,
      'Request queued successfully': (r) => r.json('status') === 'queued',
    });
    
    // Poll for export completion
    let exportCompleted = false;
    let pollAttempts = 0;
    const maxPollAttempts = 20;
    
    while (!exportCompleted && pollAttempts < maxPollAttempts) {
      sleep(3);
      pollAttempts++;
      
      const statusStartTime = Date.now();
      
      const statusResponse = http.get(
        `${BASE_URL}/api/gdpr/export/${exportId}/status`,
        {
          headers,
          tags: { operation: 'export_status_check' }
        }
      );
      
      const statusDuration = Date.now() - statusStartTime;
      gdprProcessingTime.add(statusDuration, { operation: 'status_check' });
      
      if (statusResponse.status === 200) {
        const status = statusResponse.json('status');
        const progress = statusResponse.json('progress') || 0;
        
        check(statusResponse, {
          'Status check successful': () => status !== undefined,
          'Progress tracking available': () => progress >= 0 && progress <= 100,
        });
        
        if (status === 'completed') {
          exportCompleted = true;
          
          const downloadStartTime = Date.now();
          
          // Download the export
          const downloadResponse = http.get(
            `${BASE_URL}/api/gdpr/export/${exportId}/download`,
            {
              headers,
              tags: { operation: 'export_download' }
            }
          );
          
          const downloadDuration = Date.now() - downloadStartTime;
          const totalDuration = Date.now() - startTime;
          
          dataExportTime.add(totalDuration);
          gdprProcessingTime.add(downloadDuration, { operation: 'download' });
          
          const downloadSuccess = checkResponse(downloadResponse, 200, {
            operation: 'export_download',
            endpoint: 'gdpr'
          });
          
          if (downloadSuccess) {
            const contentType = downloadResponse.headers['Content-Type'];
            const contentLength = downloadResponse.headers['Content-Length'];
            
            check(downloadResponse, {
              'Export file downloaded': () => downloadResponse.body.length > 0,
              'Correct content type': () => contentType && (contentType.includes('json') || contentType.includes('csv')),
              'File size reasonable': () => contentLength && parseInt(contentLength) > 0,
            });
            
            dataVolumeProcessed.add(parseInt(contentLength) || downloadResponse.body.length);
            
            // Verify export contains expected data
            if (exportRequest.format === 'json' && contentType.includes('json')) {
              try {
                const exportData = JSON.parse(downloadResponse.body);
                
                check(downloadResponse, {
                  'Export contains personal data': () => exportData.personal_data !== undefined,
                  'Export contains email history': () => exportData.email_history !== undefined,
                  'Export includes metadata': () => exportData.metadata !== undefined,
                  'Data is properly structured': () => typeof exportData === 'object',
                });
              } catch (e) {
                console.log('Failed to parse export JSON:', e);
              }
            }
          }
          
        } else if (status === 'failed') {
          gdprRequestSuccessRate.add(false);
          console.log('Data export failed');
          break;
        }
      }
    }
    
    if (!exportCompleted) {
      console.log('Data export did not complete within timeout');
    }
  }
  
  thinkTime(15, 30); // Longer pause for data export operations
}

/**
 * Consent Management Test
 * Tests consent checking and management performance
 */
export function consentManagementTest() {
  const token = authenticate();
  const headers = getAuthHeaders(token);
  
  concurrentGdprOps.add(1);
  
  const userEmail = TestData.randomEmail();
  
  // Test consent check
  const checkStartTime = Date.now();
  
  const consentCheckResponse = http.get(
    `${BASE_URL}/api/gdpr/consent?email=${encodeURIComponent(userEmail)}&purpose=email_marketing`,
    {
      headers,
      tags: { operation: 'consent_check' }
    }
  );
  
  const checkDuration = Date.now() - checkStartTime;
  
  consentCheckTime.add(checkDuration);
  gdprProcessingTime.add(checkDuration, { operation: 'consent_check' });
  
  const checkSuccess = checkResponse(consentCheckResponse, 200, {
    operation: 'consent_check',
    endpoint: 'gdpr'
  });
  
  if (checkSuccess) {
    const consentData = consentCheckResponse.json();
    
    check(consentCheckResponse, {
      'Consent status available': () => consentData.consent_given !== undefined,
      'Consent timestamp present': () => consentData.consent_timestamp !== undefined,
      'Consent purpose specified': () => consentData.purpose === 'email_marketing',
    });
    
    consentValidityRate.add(consentData.consent_given === true ? 1 : 0);
  }
  
  // Test consent update
  const consentUpdate = {
    email: userEmail,
    purposes: ['email_marketing', 'analytics', 'product_updates'],
    consent_given: Math.random() > 0.3, // 70% consent rate
    ip_address: '192.168.1.100',
    user_agent: 'Load Test Agent',
    consent_method: 'explicit',
  };
  
  const updateStartTime = Date.now();
  
  const consentUpdateResponse = http.post(
    `${BASE_URL}/api/gdpr/consent`,
    JSON.stringify(consentUpdate),
    {
      headers,
      tags: { operation: 'consent_update' }
    }
  );
  
  const updateDuration = Date.now() - updateStartTime;
  
  consentCheckTime.add(updateDuration);
  gdprProcessingTime.add(updateDuration, { operation: 'consent_update' });
  
  const updateSuccess = checkResponse(consentUpdateResponse, 200, {
    operation: 'consent_update',
    endpoint: 'gdpr'
  });
  
  if (updateSuccess) {
    check(consentUpdateResponse, {
      'Consent updated successfully': (r) => r.json('updated') === true,
      'Audit trail created': (r) => r.json('audit_id') !== undefined,
      'Consent ID returned': (r) => r.json('consent_id') !== undefined,
    });
  }
  
  // Test bulk consent check
  const bulkEmails = [];
  for (let i = 0; i < 20; i++) {
    bulkEmails.push(TestData.randomEmail());
  }
  
  const bulkCheckStartTime = Date.now();
  
  const bulkCheckResponse = http.post(
    `${BASE_URL}/api/gdpr/consent/bulk-check`,
    JSON.stringify({
      emails: bulkEmails,
      purpose: 'email_marketing',
    }),
    {
      headers,
      tags: { operation: 'bulk_consent_check' }
    }
  );
  
  const bulkCheckDuration = Date.now() - bulkCheckStartTime;
  
  consentCheckTime.add(bulkCheckDuration);
  gdprProcessingTime.add(bulkCheckDuration, { operation: 'bulk_consent_check' });
  
  checkResponse(bulkCheckResponse, 200, {
    operation: 'bulk_consent_check',
    endpoint: 'gdpr'
  });
  
  dataVolumeProcessed.add(bulkEmails.length);
  
  thinkTime(2, 5);
}

/**
 * Data Deletion Test
 * Tests right to be forgotten (GDPR Article 17) performance
 */
export function dataDeletionTest() {
  const token = authenticate();
  const headers = getAuthHeaders(token);
  
  concurrentGdprOps.add(1);
  
  const deletionRequest = {
    email: TestData.randomEmail(),
    deletion_type: Math.random() > 0.5 ? 'complete' : 'anonymize',
    reason: 'user_request',
    cascade_deletes: true,
    verify_consent_withdrawal: true,
  };
  
  const startTime = Date.now();
  
  const deletionResponse = http.post(
    `${BASE_URL}/api/gdpr/delete`,
    JSON.stringify(deletionRequest),
    {
      headers,
      tags: { 
        operation: 'data_deletion',
        deletion_type: deletionRequest.deletion_type 
      }
    }
  );
  
  const requestDuration = Date.now() - startTime;
  
  gdprProcessingTime.add(requestDuration, { operation: 'deletion_request' });
  PerformanceMonitor.trackApiOperation('gdpr/delete', requestDuration, deletionResponse.status);
  
  const deletionSuccess = checkResponse(deletionResponse, 202, {
    operation: 'data_deletion',
    endpoint: 'gdpr'
  });
  
  gdprRequestSuccessRate.add(deletionSuccess);
  
  if (deletionSuccess) {
    const deletionId = deletionResponse.json('deletion_id');
    
    check(deletionResponse, {
      'Deletion request accepted': () => deletionId !== undefined,
      'Deletion type recorded': (r) => r.json('deletion_type') === deletionRequest.deletion_type,
      'Cascade deletes configured': (r) => r.json('cascade_deletes') === true,
    });
    
    // Monitor deletion progress
    let deletionCompleted = false;
    let pollAttempts = 0;
    const maxPollAttempts = 15;
    
    while (!deletionCompleted && pollAttempts < maxPollAttempts) {
      sleep(4);
      pollAttempts++;
      
      const statusResponse = http.get(
        `${BASE_URL}/api/gdpr/delete/${deletionId}/status`,
        {
          headers,
          tags: { operation: 'deletion_status_check' }
        }
      );
      
      if (statusResponse.status === 200) {
        const status = statusResponse.json('status');
        const tablesProcessed = statusResponse.json('tables_processed') || 0;
        const totalTables = statusResponse.json('total_tables') || 1;
        
        check(statusResponse, {
          'Deletion status available': () => status !== undefined,
          'Progress tracking works': () => tablesProcessed >= 0,
          'Table count reasonable': () => totalTables > 0,
        });
        
        if (status === 'completed') {
          deletionCompleted = true;
          const totalDuration = Date.now() - startTime;
          
          dataDeletionTime.add(totalDuration);
          
          const deletionReport = statusResponse.json('deletion_report');
          
          if (deletionReport) {
            check(statusResponse, {
              'Deletion report available': () => deletionReport !== null,
              'Records deleted count': () => deletionReport.records_deleted >= 0,
              'Tables affected listed': () => Array.isArray(deletionReport.tables_affected),
            });
            
            dataVolumeProcessed.add(deletionReport.records_deleted || 0);
            
            if (deletionRequest.deletion_type === 'anonymize') {
              anonymizationEffectiveness.add(deletionReport.anonymization_successful ? 1 : 0);
            }
          }
          
        } else if (status === 'failed') {
          gdprRequestSuccessRate.add(false);
          console.log('Data deletion failed');
          break;
        }
      }
    }
  }
  
  thinkTime(20, 40); // Longer pause for deletion operations
}

/**
 * Audit Logging Test
 * Tests GDPR audit logging performance
 */
export function auditLoggingTest() {
  const token = authenticate();
  const headers = getAuthHeaders(token);
  
  concurrentGdprOps.add(1);
  
  // Create audit log entry
  const auditEntry = {
    action: 'data_access',
    resource_type: 'personal_data',
    resource_id: TestData.randomString(16),
    user_email: TestData.randomEmail(),
    ip_address: `192.168.1.${TestData.randomNumber(1, 254)}`,
    user_agent: 'Load Test Client',
    legal_basis: 'legitimate_interest',
    purpose: 'email_marketing',
    data_categories: ['contact_info', 'behavioral_data'],
  };
  
  const startTime = Date.now();
  
  const auditResponse = http.post(
    `${BASE_URL}/api/gdpr/audit`,
    JSON.stringify(auditEntry),
    {
      headers,
      tags: { 
        operation: 'audit_log_create',
        action: auditEntry.action 
      }
    }
  );
  
  const auditDuration = Date.now() - startTime;
  
  auditLogTime.add(auditDuration);
  gdprProcessingTime.add(auditDuration, { operation: 'audit_log' });
  
  const auditSuccess = checkResponse(auditResponse, 201, {
    operation: 'audit_log',
    endpoint: 'gdpr'
  });
  
  if (auditSuccess) {
    check(auditResponse, {
      'Audit entry created': (r) => r.json('audit_id') !== undefined,
      'Timestamp recorded': (r) => r.json('timestamp') !== undefined,
      'Legal basis captured': (r) => r.json('legal_basis') === auditEntry.legal_basis,
    });
  }
  
  // Query audit logs (simulating compliance reporting)
  if (Math.random() < 0.3) { // 30% chance to query logs
    const queryStartTime = Date.now();
    
    const queryResponse = http.get(
      `${BASE_URL}/api/gdpr/audit?date_from=${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()}&limit=100`,
      {
        headers,
        tags: { operation: 'audit_log_query' }
      }
    );
    
    const queryDuration = Date.now() - queryStartTime;
    
    auditLogTime.add(queryDuration);
    
    const querySuccess = checkResponse(queryResponse, 200, {
      operation: 'audit_log_query',
      endpoint: 'gdpr'
    });
    
    if (querySuccess) {
      const logs = queryResponse.json('logs') || [];
      
      check(queryResponse, {
        'Audit logs retrieved': () => Array.isArray(logs),
        'Logs have required fields': () => logs.length === 0 || logs[0].audit_id !== undefined,
        'Query performance acceptable': (r) => r.timings.duration < 3000,
      });
      
      dataVolumeProcessed.add(logs.length);
    }
  }
  
  // Very short think time for audit logging
  sleep(0.1);
}

/**
 * Privacy Compliance Test
 * Tests overall privacy compliance checking
 */
export function privacyComplianceTest() {
  const token = authenticate();
  const headers = getAuthHeaders(token);
  
  concurrentGdprOps.add(1);
  
  const complianceOperations = [
    () => testDataProcessingAgreement(headers),
    () => testPrivacyPolicyCompliance(headers),
    () => testCookieCompliance(headers),
    () => testDataMinimization(headers),
    () => testConsentWithdrawal(headers),
  ];
  
  // Execute 2-3 compliance checks
  const selectedOps = complianceOperations.sort(() => 0.5 - Math.random()).slice(0, 2 + Math.floor(Math.random() * 2));
  
  for (const operation of selectedOps) {
    operation();
    sleep(1); // Brief pause between operations
  }
  
  thinkTime(5, 10);
}

/**
 * Data Retention Test
 * Tests automated data retention policy execution
 */
export function dataRetentionTest() {
  const token = authenticate();
  const headers = getAuthHeaders(token);
  
  concurrentGdprOps.add(1);
  
  // Trigger retention policy execution
  const retentionRequest = {
    policy_type: 'email_data',
    retention_period_days: 365,
    dry_run: Math.random() > 0.7, // 30% actual runs, 70% dry runs
    apply_to_tables: ['emails', 'email_tracking', 'email_templates'],
  };
  
  const startTime = Date.now();
  
  const retentionResponse = http.post(
    `${BASE_URL}/api/gdpr/retention/execute`,
    JSON.stringify(retentionRequest),
    {
      headers,
      tags: { 
        operation: 'retention_policy',
        dry_run: retentionRequest.dry_run 
      }
    }
  );
  
  const requestDuration = Date.now() - startTime;
  
  gdprProcessingTime.add(requestDuration, { operation: 'retention_policy' });
  
  const retentionSuccess = checkResponse(retentionResponse, 202, {
    operation: 'retention_policy',
    endpoint: 'gdpr'
  });
  
  if (retentionSuccess) {
    const jobId = retentionResponse.json('job_id');
    
    check(retentionResponse, {
      'Retention job started': () => jobId !== undefined,
      'Dry run flag respected': (r) => r.json('dry_run') === retentionRequest.dry_run,
      'Tables specified': (r) => Array.isArray(r.json('tables')),
    });
    
    retentionPolicyExecutions.add(1);
    
    // Monitor retention job progress
    let jobCompleted = false;
    let pollAttempts = 0;
    const maxPollAttempts = 10;
    
    while (!jobCompleted && pollAttempts < maxPollAttempts) {
      sleep(5);
      pollAttempts++;
      
      const statusResponse = http.get(
        `${BASE_URL}/api/gdpr/retention/${jobId}/status`,
        {
          headers,
          tags: { operation: 'retention_status' }
        }
      );
      
      if (statusResponse.status === 200) {
        const status = statusResponse.json('status');
        const progress = statusResponse.json('progress') || {};
        
        if (status === 'completed') {
          jobCompleted = true;
          const totalDuration = Date.now() - startTime;
          
          gdprProcessingTime.add(totalDuration, { operation: 'retention_complete' });
          
          check(statusResponse, {
            'Retention job completed': () => status === 'completed',
            'Progress report available': () => progress !== null,
            'Records processed count': () => progress.records_processed >= 0,
          });
          
          dataVolumeProcessed.add(progress.records_processed || 0);
          
          if (!retentionRequest.dry_run) {
            dataVolumeProcessed.add(progress.records_deleted || 0);
          }
          
        } else if (status === 'failed') {
          console.log('Retention policy execution failed');
          break;
        }
      }
    }
  }
  
  thinkTime(30, 60); // Long pause for retention operations
}

// Helper functions for privacy compliance testing
function testDataProcessingAgreement(headers) {
  const startTime = Date.now();
  
  const response = http.get(
    `${BASE_URL}/api/gdpr/processing-agreement/status`,
    {
      headers,
      tags: { operation: 'dpa_check' }
    }
  );
  
  const duration = Date.now() - startTime;
  gdprProcessingTime.add(duration, { operation: 'dpa_check' });
  
  const success = checkResponse(response, 200, { operation: 'dpa_check' });
  dataPrivacyComplianceRate.add(success ? 1 : 0);
}

function testPrivacyPolicyCompliance(headers) {
  const startTime = Date.now();
  
  const response = http.get(
    `${BASE_URL}/api/gdpr/privacy-policy/compliance-check`,
    {
      headers,
      tags: { operation: 'privacy_policy_check' }
    }
  );
  
  const duration = Date.now() - startTime;
  gdprProcessingTime.add(duration, { operation: 'privacy_policy' });
  
  const success = checkResponse(response, 200, { operation: 'privacy_policy' });
  dataPrivacyComplianceRate.add(success ? 1 : 0);
}

function testCookieCompliance(headers) {
  const startTime = Date.now();
  
  const response = http.get(
    `${BASE_URL}/api/gdpr/cookies/compliance-status`,
    {
      headers,
      tags: { operation: 'cookie_compliance' }
    }
  );
  
  const duration = Date.now() - startTime;
  gdprProcessingTime.add(duration, { operation: 'cookie_compliance' });
  
  const success = checkResponse(response, 200, { operation: 'cookie_compliance' });
  dataPrivacyComplianceRate.add(success ? 1 : 0);
}

function testDataMinimization(headers) {
  const startTime = Date.now();
  
  const response = http.get(
    `${BASE_URL}/api/gdpr/data-minimization/report`,
    {
      headers,
      tags: { operation: 'data_minimization' }
    }
  );
  
  const duration = Date.now() - startTime;
  gdprProcessingTime.add(duration, { operation: 'data_minimization' });
  
  const success = checkResponse(response, 200, { operation: 'data_minimization' });
  dataPrivacyComplianceRate.add(success ? 1 : 0);
}

function testConsentWithdrawal(headers) {
  const withdrawalData = {
    email: TestData.randomEmail(),
    purposes: ['email_marketing', 'analytics'],
    withdrawal_reason: 'user_request',
  };
  
  const startTime = Date.now();
  
  const response = http.post(
    `${BASE_URL}/api/gdpr/consent/withdraw`,
    JSON.stringify(withdrawalData),
    {
      headers,
      tags: { operation: 'consent_withdrawal' }
    }
  );
  
  const duration = Date.now() - startTime;
  gdprProcessingTime.add(duration, { operation: 'consent_withdrawal' });
  
  const success = checkResponse(response, 200, { operation: 'consent_withdrawal' });
  dataPrivacyComplianceRate.add(success ? 1 : 0);
}

// Export metrics for use in other tests
export {
  gdprProcessingTime,
  dataExportTime,
  dataDeletionTime,
  consentCheckTime,
  auditLogTime,
  gdprRequestSuccessRate,
  dataPrivacyComplianceRate,
  consentValidityRate,
  anonymizationEffectiveness,
  concurrentGdprOps,
  dataVolumeProcessed,
  retentionPolicyExecutions,
};