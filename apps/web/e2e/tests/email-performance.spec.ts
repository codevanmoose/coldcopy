import { test, expect } from '@playwright/test'
import { faker } from '@faker-js/faker'
import { CampaignPage } from '../pages/campaign.page'
import { AuthPage } from '../pages/auth.page'
import { visualRegressionHelpers } from '../helpers/visual-regression'

test.describe('Email Campaign Performance', () => {
  let campaignPage: CampaignPage
  let authPage: AuthPage

  test.beforeEach(async ({ page }) => {
    campaignPage = new CampaignPage(page)
    authPage = new AuthPage(page)
    
    // Login as authenticated user
    await authPage.login('test@example.com', 'password123')
  })

  test.describe('High-Volume Email Sending', () => {
    test('should handle high-volume email campaigns efficiently', async ({ page }) => {
      // Mock high-volume campaign setup
      await page.route('**/api/campaigns', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'campaign_high_volume_123',
              name: 'High Volume Test Campaign',
              status: 'active',
              totalLeads: 50000,
              dailyLimit: 5000
            })
          })
        }
      })

      // Mock sending queue
      await page.route('**/api/campaigns/*/send', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            queued: 5000,
            estimatedCompletionTime: '2024-01-01T18:00:00Z',
            queuePosition: 1
          })
        })
      })

      const campaignData = {
        name: `High Volume Campaign ${faker.string.uuid()}`,
        description: 'Testing high-volume email sending capabilities',
        type: 'email_sequence'
      }

      await campaignPage.createCampaign(campaignData)
      
      // Configure for high volume
      await campaignPage.configureCampaignSettings({
        dailyLimit: 5000,
        sendingSchedule: '24_7',
        timezone: 'UTC',
        trackOpens: true,
        trackClicks: true,
        trackReplies: true
      })

      await campaignPage.launchCampaign()
      
      // Verify high-volume handling
      await campaignPage.expectText('[data-testid="emails-queued"]', '5,000')
      await campaignPage.expectVisible('[data-testid="queue-status"]')
      
      // Take screenshot of high-volume campaign
      await visualRegressionHelpers.takeScreenshot(page, 'high-volume-campaign')
    })

    test('should monitor sending rate and throttling', async ({ page }) => {
      // Mock sending rate monitoring
      await page.route('**/api/campaigns/*/sending-rate', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            current_rate: 145, // emails per minute
            target_rate: 150,
            throttle_active: false,
            daily_sent: 3250,
            daily_limit: 5000,
            remaining_today: 1750
          })
        })
      })

      const campaignId = 'campaign_rate_test_123'
      await page.goto(`/campaigns/${campaignId}`)
      
      // Verify rate monitoring display
      await campaignPage.expectVisible('[data-testid="sending-rate-monitor"]')
      await campaignPage.expectText('[data-testid="current-rate"]', '145 emails/min')
      await campaignPage.expectText('[data-testid="daily-progress"]', '3,250 of 5,000')
      
      // Take screenshot of rate monitoring
      await visualRegressionHelpers.takeScreenshot(page, 'sending-rate-monitor')
    })

    test('should handle rate limiting and backoff strategies', async ({ page }) => {
      // Mock rate limiting scenario
      await page.route('**/api/campaigns/*/send', async (route) => {
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Rate limit exceeded',
            retry_after: 300, // 5 minutes
            current_rate: 200,
            max_rate: 150
          })
        })
      })

      await campaignPage.goToCampaigns()
      await campaignPage.launchCampaignButton.click()
      
      // Verify rate limiting handling
      await campaignPage.expectVisible('[data-testid="rate-limit-warning"]')
      await campaignPage.expectText('[data-testid="retry-time"]', '5 minutes')
      
      // Verify automatic retry is scheduled
      await campaignPage.expectVisible('[data-testid="auto-retry-scheduled"]')
    })

    test('should optimize sending times based on recipient timezone', async ({ page }) => {
      // Mock timezone optimization
      await page.route('**/api/campaigns/*/optimize-timing', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            optimized_schedule: {
              'UTC-8': { send_time: '09:00', lead_count: 1500 },
              'UTC-5': { send_time: '09:00', lead_count: 2000 },
              'UTC+1': { send_time: '09:00', lead_count: 800 },
              'UTC+8': { send_time: '09:00', lead_count: 700 }
            },
            estimated_completion: '2024-01-02T17:00:00Z'
          })
        })
      })

      await campaignPage.goToNewCampaign()
      
      // Enable timezone optimization
      await page.check('input[data-testid="optimize-send-times"]')
      await campaignPage.configureCampaignSettings({
        dailyLimit: 5000,
        sendingSchedule: 'optimized',
        timezone: 'auto'
      })

      // Verify optimization is applied
      await campaignPage.expectVisible('[data-testid="timezone-optimization"]')
      await campaignPage.expectText('[data-testid="optimization-summary"]', '4 timezones')
    })

    test('should handle email provider limitations and switching', async ({ page }) => {
      // Mock provider switching
      await page.route('**/api/email/providers/status', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            providers: [
              { name: 'ses', status: 'active', daily_limit: 10000, used_today: 8500 },
              { name: 'sendgrid', status: 'active', daily_limit: 5000, used_today: 1200 },
              { name: 'mailgun', status: 'maintenance', daily_limit: 8000, used_today: 0 }
            ],
            active_provider: 'ses',
            failover_enabled: true
          })
        })
      })

      const campaignId = 'campaign_provider_test_123'
      await page.goto(`/campaigns/${campaignId}`)
      
      // Verify provider status
      await campaignPage.expectVisible('[data-testid="email-providers-status"]')
      await campaignPage.expectText('[data-testid="active-provider"]', 'Amazon SES')
      await campaignPage.expectText('[data-testid="failover-status"]', 'Enabled')
      
      // Mock provider failover
      await page.route('**/api/email/send', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            provider_used: 'sendgrid',
            failover_triggered: true,
            reason: 'SES daily limit reached'
          })
        })
      })

      // Verify failover notification
      await campaignPage.expectVisible('[data-testid="provider-failover-notice"]')
    })
  })

  test.describe('Delivery Tracking', () => {
    test('should track email delivery status in real-time', async ({ page }) => {
      // Mock real-time delivery tracking
      await page.route('**/api/campaigns/*/delivery-tracking', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            total_sent: 1000,
            delivered: 950,
            bounced: 25,
            deferred: 15,
            failed: 10,
            delivery_rate: 95.0,
            last_updated: '2024-01-01T12:00:00Z'
          })
        })
      })

      const campaignId = 'campaign_delivery_123'
      await page.goto(`/campaigns/${campaignId}/tracking`)
      
      // Verify delivery tracking display
      await campaignPage.expectVisible('[data-testid="delivery-tracking-dashboard"]')
      await campaignPage.expectText('[data-testid="delivery-rate"]', '95.0%')
      await campaignPage.expectText('[data-testid="total-delivered"]', '950')
      await campaignPage.expectText('[data-testid="total-bounced"]', '25')
      
      // Take screenshot of delivery tracking
      await visualRegressionHelpers.takeScreenshot(page, 'delivery-tracking-dashboard')
    })

    test('should categorize and display bounce types', async ({ page }) => {
      // Mock bounce categorization
      await page.route('**/api/campaigns/*/bounces', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            bounces: [
              {
                email: 'nonexistent@example.com',
                type: 'permanent',
                reason: 'No such user',
                bounce_code: '5.1.1',
                timestamp: '2024-01-01T10:00:00Z'
              },
              {
                email: 'full@example.com',
                type: 'temporary',
                reason: 'Mailbox full',
                bounce_code: '4.2.2',
                timestamp: '2024-01-01T10:05:00Z'
              },
              {
                email: 'blocked@example.com',
                type: 'permanent',
                reason: 'Blocked by recipient',
                bounce_code: '5.7.1',
                timestamp: '2024-01-01T10:10:00Z'
              }
            ],
            summary: {
              permanent: 15,
              temporary: 10,
              total: 25
            }
          })
        })
      })

      const campaignId = 'campaign_bounces_123'
      await page.goto(`/campaigns/${campaignId}/bounces`)
      
      // Verify bounce categorization
      await campaignPage.expectVisible('[data-testid="bounce-categories"]')
      await campaignPage.expectText('[data-testid="permanent-bounces"]', '15')
      await campaignPage.expectText('[data-testid="temporary-bounces"]', '10')
      
      // Verify bounce details table
      await campaignPage.expectVisible('[data-testid="bounce-details-table"]')
      await expect(page.locator('[data-testid="bounce-details-table"]')).toContainText('No such user')
      await expect(page.locator('[data-testid="bounce-details-table"]')).toContainText('Mailbox full')
    })

    test('should handle delivery delays and deferred emails', async ({ page }) => {
      // Mock deferred email tracking
      await page.route('**/api/campaigns/*/deferred', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            deferred_emails: [
              {
                email: 'delayed@example.com',
                reason: 'Recipient server temporarily unavailable',
                retry_count: 2,
                next_retry: '2024-01-01T13:00:00Z',
                max_retries: 5
              },
              {
                email: 'throttled@example.com',
                reason: 'Rate limit from recipient server',
                retry_count: 1,
                next_retry: '2024-01-01T12:30:00Z',
                max_retries: 5
              }
            ],
            total_deferred: 15,
            avg_retry_time: 45 // minutes
          })
        })
      })

      const campaignId = 'campaign_deferred_123'
      await page.goto(`/campaigns/${campaignId}/deferred`)
      
      // Verify deferred email tracking
      await campaignPage.expectVisible('[data-testid="deferred-emails-table"]')
      await campaignPage.expectText('[data-testid="total-deferred"]', '15')
      await campaignPage.expectText('[data-testid="avg-retry-time"]', '45 minutes')
      
      // Verify retry scheduling
      await expect(page.locator('[data-testid="deferred-emails-table"]')).toContainText('2 retries')
      await expect(page.locator('[data-testid="deferred-emails-table"]')).toContainText('Next retry')
    })

    test('should provide delivery insights and recommendations', async ({ page }) => {
      // Mock delivery insights
      await page.route('**/api/campaigns/*/delivery-insights', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            insights: [
              {
                type: 'recommendation',
                title: 'Improve delivery rate',
                message: 'Consider cleaning your email list. 15% of bounces are permanent.',
                action: 'clean_list',
                priority: 'high'
              },
              {
                type: 'warning',
                title: 'Domain reputation issue',
                message: 'gmail.com recipients showing higher bounce rate (8% vs 2% average).',
                action: 'check_domain_reputation',
                priority: 'medium'
              },
              {
                type: 'info',
                title: 'Optimal sending time',
                message: 'Best delivery rates observed between 9-11 AM recipient local time.',
                action: 'optimize_timing',
                priority: 'low'
              }
            ],
            overall_health: 'good',
            delivery_score: 85
          })
        })
      })

      const campaignId = 'campaign_insights_123'
      await page.goto(`/campaigns/${campaignId}/insights`)
      
      // Verify delivery insights
      await campaignPage.expectVisible('[data-testid="delivery-insights"]')
      await campaignPage.expectText('[data-testid="delivery-score"]', '85')
      await campaignPage.expectText('[data-testid="overall-health"]', 'Good')
      
      // Verify recommendations
      await campaignPage.expectVisible('[data-testid="recommendations"]')
      await expect(page.locator('[data-testid="recommendations"]')).toContainText('Improve delivery rate')
      await expect(page.locator('[data-testid="recommendations"]')).toContainText('Domain reputation issue')
    })
  })

  test.describe('Bounce and Complaint Handling', () => {
    test('should automatically process hard bounces', async ({ page }) => {
      // Mock bounce processing
      await page.route('**/api/email/bounces/process', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            processed: 15,
            suppressed: 12,
            retried: 3,
            actions: [
              { email: 'nonexistent@example.com', action: 'suppressed', reason: 'Permanent bounce' },
              { email: 'full@example.com', action: 'retry_scheduled', reason: 'Temporary bounce' }
            ]
          })
        })
      })

      const campaignId = 'campaign_bounce_processing_123'
      await page.goto(`/campaigns/${campaignId}/bounces`)
      
      // Process bounces
      await page.click('button[data-testid="process-bounces"]')
      
      // Verify bounce processing results
      await campaignPage.expectText('[data-testid="bounces-processed"]', '15 bounces processed')
      await campaignPage.expectText('[data-testid="emails-suppressed"]', '12 emails suppressed')
      await campaignPage.expectText('[data-testid="retries-scheduled"]', '3 retries scheduled')
      
      // Verify suppression list update
      await campaignPage.expectVisible('[data-testid="suppression-list-updated"]')
    })

    test('should handle spam complaints and feedback loops', async ({ page }) => {
      // Mock complaint processing
      await page.route('**/api/email/complaints', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            complaints: [
              {
                email: 'complainer@example.com',
                type: 'abuse',
                source: 'gmail',
                timestamp: '2024-01-01T10:00:00Z',
                action_taken: 'suppressed'
              },
              {
                email: 'reporter@example.com',
                type: 'spam',
                source: 'outlook',
                timestamp: '2024-01-01T10:15:00Z',
                action_taken: 'suppressed'
              }
            ],
            complaint_rate: 0.02, // 0.02%
            threshold: 0.1, // 0.1%
            status: 'acceptable'
          })
        })
      })

      const campaignId = 'campaign_complaints_123'
      await page.goto(`/campaigns/${campaignId}/complaints`)
      
      // Verify complaint tracking
      await campaignPage.expectVisible('[data-testid="complaints-dashboard"]')
      await campaignPage.expectText('[data-testid="complaint-rate"]', '0.02%')
      await campaignPage.expectText('[data-testid="complaint-status"]', 'Acceptable')
      
      // Verify complaint details
      await campaignPage.expectVisible('[data-testid="complaints-table"]')
      await expect(page.locator('[data-testid="complaints-table"]')).toContainText('abuse')
      await expect(page.locator('[data-testid="complaints-table"]')).toContainText('spam')
      
      // Take screenshot of complaints dashboard
      await visualRegressionHelpers.takeScreenshot(page, 'complaints-dashboard')
    })

    test('should trigger alerts for high complaint rates', async ({ page }) => {
      // Mock high complaint rate
      await page.route('**/api/email/complaints', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            complaint_rate: 0.15, // 0.15% - above threshold
            threshold: 0.1,
            status: 'warning',
            recent_increase: true,
            alert_triggered: true
          })
        })
      })

      const campaignId = 'campaign_high_complaints_123'
      await page.goto(`/campaigns/${campaignId}`)
      
      // Verify high complaint rate alert
      await campaignPage.expectVisible('[data-testid="high-complaint-alert"]')
      await campaignPage.expectText('[data-testid="complaint-rate-warning"]', '0.15%')
      await campaignPage.expectVisible('[data-testid="complaint-mitigation-actions"]')
      
      // Verify automatic campaign pause option
      await campaignPage.expectVisible('button[data-testid="pause-campaign-complaints"]')
    })

    test('should manage suppression lists effectively', async ({ page }) => {
      // Mock suppression list
      await page.route('**/api/email/suppression-list', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            suppressed_emails: [
              {
                email: 'bounced@example.com',
                reason: 'Hard bounce',
                date_added: '2024-01-01T10:00:00Z',
                source: 'campaign_123'
              },
              {
                email: 'complained@example.com',
                reason: 'Spam complaint',
                date_added: '2024-01-01T11:00:00Z',
                source: 'feedback_loop'
              },
              {
                email: 'manual@example.com',
                reason: 'Manual addition',
                date_added: '2024-01-01T12:00:00Z',
                source: 'user_request'
              }
            ],
            total_suppressed: 1543,
            last_updated: '2024-01-01T12:00:00Z'
          })
        })
      })

      await page.goto('/settings/email/suppression-list')
      
      // Verify suppression list display
      await campaignPage.expectVisible('[data-testid="suppression-list-table"]')
      await campaignPage.expectText('[data-testid="total-suppressed"]', '1,543')
      
      // Test suppression list search
      await page.fill('input[data-testid="suppression-search"]', 'bounced@example.com')
      await page.keyboard.press('Enter')
      
      await expect(page.locator('[data-testid="suppression-list-table"]')).toContainText('bounced@example.com')
      
      // Test manual removal from suppression list
      await page.click('button[data-testid="remove-from-suppression"]')
      await page.click('button[data-testid="confirm-removal"]')
      
      await campaignPage.expectText('[data-testid="success-message"]', 'Email removed from suppression list')
    })
  })

  test.describe('Reply Detection', () => {
    test('should detect and categorize email replies', async ({ page }) => {
      // Mock reply detection
      await page.route('**/api/campaigns/*/replies', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            replies: [
              {
                id: 'reply_1',
                lead_email: 'interested@example.com',
                subject: 'Re: Partnership Opportunity',
                body: 'Thanks for reaching out! I\'m interested in learning more about your solution.',
                sentiment: 'positive',
                intent: 'interested',
                timestamp: '2024-01-01T10:00:00Z',
                auto_tagged: ['interested', 'meeting_request']
              },
              {
                id: 'reply_2',
                lead_email: 'notinterested@example.com',
                subject: 'Re: Partnership Opportunity',
                body: 'Please remove me from your mailing list.',
                sentiment: 'negative',
                intent: 'unsubscribe',
                timestamp: '2024-01-01T10:30:00Z',
                auto_tagged: ['unsubscribe', 'not_interested']
              },
              {
                id: 'reply_3',
                lead_email: 'ooo@example.com',
                subject: 'Auto-Reply: Out of Office',
                body: 'I am currently out of office and will return on January 15th.',
                sentiment: 'neutral',
                intent: 'out_of_office',
                timestamp: '2024-01-01T11:00:00Z',
                auto_tagged: ['out_of_office']
              }
            ],
            summary: {
              total_replies: 45,
              positive: 20,
              negative: 8,
              neutral: 17,
              interested: 15,
              not_interested: 5,
              out_of_office: 12
            }
          })
        })
      })

      const campaignId = 'campaign_replies_123'
      await page.goto(`/campaigns/${campaignId}/replies`)
      
      // Verify reply detection dashboard
      await campaignPage.expectVisible('[data-testid="reply-detection-dashboard"]')
      await campaignPage.expectText('[data-testid="total-replies"]', '45')
      await campaignPage.expectText('[data-testid="positive-replies"]', '20')
      await campaignPage.expectText('[data-testid="interested-leads"]', '15')
      
      // Verify reply categorization
      await campaignPage.expectVisible('[data-testid="replies-table"]')
      await expect(page.locator('[data-testid="replies-table"]')).toContainText('interested')
      await expect(page.locator('[data-testid="replies-table"]')).toContainText('unsubscribe')
      await expect(page.locator('[data-testid="replies-table"]')).toContainText('out_of_office')
      
      // Take screenshot of reply detection
      await visualRegressionHelpers.takeScreenshot(page, 'reply-detection-dashboard')
    })

    test('should automatically tag replies based on content', async ({ page }) => {
      // Mock AI-powered reply tagging
      await page.route('**/api/ai/analyze-reply', async (route) => {
        const requestBody = await route.request().postDataJSON()
        const replyContent = requestBody.content.toLowerCase()
        
        let tags = []
        let sentiment = 'neutral'
        let intent = 'general'
        
        if (replyContent.includes('interested') || replyContent.includes('tell me more')) {
          tags = ['interested', 'follow_up_needed']
          sentiment = 'positive'
          intent = 'interested'
        } else if (replyContent.includes('not interested') || replyContent.includes('remove')) {
          tags = ['not_interested', 'unsubscribe']
          sentiment = 'negative'
          intent = 'unsubscribe'
        } else if (replyContent.includes('meeting') || replyContent.includes('call')) {
          tags = ['meeting_request', 'hot_lead']
          sentiment = 'positive'
          intent = 'meeting'
        }
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            tags,
            sentiment,
            intent,
            confidence: 0.85
          })
        })
      })

      const replyId = 'reply_test_123'
      await page.goto(`/inbox/replies/${replyId}`)
      
      // Trigger AI analysis
      await page.click('button[data-testid="analyze-reply"]')
      
      // Verify AI tagging results
      await campaignPage.expectVisible('[data-testid="ai-analysis-results"]')
      await campaignPage.expectText('[data-testid="confidence-score"]', '85%')
      await campaignPage.expectVisible('[data-testid="suggested-tags"]')
    })

    test('should integrate replies with CRM workflow', async ({ page }) => {
      // Mock CRM integration
      await page.route('**/api/crm/sync-reply', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            crm_contact_id: 'contact_123',
            activity_created: true,
            lead_status_updated: true,
            follow_up_scheduled: true
          })
        })
      })

      const replyId = 'reply_crm_123'
      await page.goto(`/inbox/replies/${replyId}`)
      
      // Sync reply to CRM
      await page.click('button[data-testid="sync-to-crm"]')
      
      // Verify CRM sync
      await campaignPage.expectText('[data-testid="crm-sync-status"]', 'Synced to CRM')
      await campaignPage.expectVisible('[data-testid="crm-contact-link"]')
      await campaignPage.expectText('[data-testid="follow-up-scheduled"]', 'Follow-up scheduled')
    })

    test('should handle reply threading and conversation tracking', async ({ page }) => {
      // Mock conversation thread
      await page.route('**/api/conversations/thread_123', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            thread_id: 'thread_123',
            lead_email: 'conversation@example.com',
            messages: [
              {
                id: 'msg_1',
                type: 'sent',
                subject: 'Partnership Opportunity',
                timestamp: '2024-01-01T09:00:00Z',
                campaign_id: 'campaign_123'
              },
              {
                id: 'msg_2',
                type: 'received',
                subject: 'Re: Partnership Opportunity',
                body: 'Interesting! Can you tell me more about pricing?',
                timestamp: '2024-01-01T10:00:00Z'
              },
              {
                id: 'msg_3',
                type: 'sent',
                subject: 'Re: Partnership Opportunity',
                body: 'Here\'s our pricing information...',
                timestamp: '2024-01-01T11:00:00Z',
                manual_reply: true
              }
            ],
            status: 'active',
            last_activity: '2024-01-01T11:00:00Z'
          })
        })
      })

      await page.goto('/inbox/conversations/thread_123')
      
      // Verify conversation threading
      await campaignPage.expectVisible('[data-testid="conversation-thread"]')
      await campaignPage.expectText('[data-testid="message-count"]', '3 messages')
      
      // Verify message types are displayed correctly
      await expect(page.locator('[data-testid="message-sent"]')).toHaveCount(2)
      await expect(page.locator('[data-testid="message-received"]')).toHaveCount(1)
      
      // Test reply composition
      await page.fill('textarea[data-testid="reply-compose"]', 'Thank you for your interest. Let me schedule a call.')
      await page.click('button[data-testid="send-reply"]')
      
      await campaignPage.expectText('[data-testid="success-message"]', 'Reply sent successfully')
    })
  })

  test.describe('Analytics Dashboard', () => {
    test('should display comprehensive email performance metrics', async ({ page }) => {
      // Mock comprehensive analytics
      await page.route('**/api/analytics/email-performance', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            overview: {
              total_sent: 50000,
              delivered: 47500,
              bounced: 1500,
              opened: 12000,
              clicked: 3600,
              replied: 450,
              unsubscribed: 75
            },
            rates: {
              delivery_rate: 95.0,
              open_rate: 25.3,
              click_rate: 7.6,
              reply_rate: 0.95,
              unsubscribe_rate: 0.16
            },
            trends: {
              period: 'last_30_days',
              delivery_rate_trend: 2.5, // +2.5%
              open_rate_trend: -1.2,    // -1.2%
              click_rate_trend: 0.8     // +0.8%
            },
            benchmarks: {
              industry: 'SaaS',
              avg_open_rate: 22.1,
              avg_click_rate: 6.2,
              avg_reply_rate: 0.7
            }
          })
        })
      })

      await page.goto('/analytics/email-performance')
      
      // Verify overview metrics
      await campaignPage.expectText('[data-testid="total-sent"]', '50,000')
      await campaignPage.expectText('[data-testid="delivery-rate"]', '95.0%')
      await campaignPage.expectText('[data-testid="open-rate"]', '25.3%')
      await campaignPage.expectText('[data-testid="click-rate"]', '7.6%')
      
      // Verify trend indicators
      await campaignPage.expectVisible('[data-testid="delivery-rate-up"]')
      await campaignPage.expectVisible('[data-testid="open-rate-down"]')
      await campaignPage.expectVisible('[data-testid="click-rate-up"]')
      
      // Verify benchmark comparison
      await campaignPage.expectText('[data-testid="open-rate-vs-benchmark"]', '+3.2% vs industry')
      
      // Take screenshot of analytics dashboard
      await visualRegressionHelpers.takeScreenshot(page, 'email-analytics-dashboard')
    })

    test('should show performance breakdown by time periods', async ({ page }) => {
      // Mock time-based analytics
      await page.route('**/api/analytics/time-breakdown', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            daily_stats: [
              { date: '2024-01-01', sent: 1000, opened: 250, clicked: 75 },
              { date: '2024-01-02', sent: 1200, opened: 290, clicked: 88 },
              { date: '2024-01-03', sent: 950, opened: 235, clicked: 70 }
            ],
            hourly_performance: {
              best_hour: 9,   // 9 AM
              best_rate: 28.5,
              worst_hour: 23, // 11 PM
              worst_rate: 12.1
            },
            day_of_week: {
              best_day: 'Tuesday',
              best_rate: 27.2,
              worst_day: 'Sunday',
              worst_rate: 18.9
            }
          })
        })
      })

      await page.goto('/analytics/time-breakdown')
      
      // Verify time-based insights
      await campaignPage.expectText('[data-testid="best-send-hour"]', '9 AM')
      await campaignPage.expectText('[data-testid="best-send-day"]', 'Tuesday')
      await campaignPage.expectText('[data-testid="peak-performance-rate"]', '28.5%')
      
      // Verify charts are displayed
      await campaignPage.expectVisible('[data-testid="daily-performance-chart"]')
      await campaignPage.expectVisible('[data-testid="hourly-heatmap"]')
      await campaignPage.expectVisible('[data-testid="weekly-breakdown"]')
    })

    test('should provide geographic performance breakdown', async ({ page }) => {
      // Mock geographic analytics
      await page.route('**/api/analytics/geographic', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            by_country: [
              { country: 'United States', sent: 25000, opened: 6500, rate: 26.0 },
              { country: 'United Kingdom', sent: 8000, opened: 2200, rate: 27.5 },
              { country: 'Germany', sent: 5000, opened: 1150, rate: 23.0 },
              { country: 'Canada', sent: 4000, opened: 1080, rate: 27.0 }
            ],
            by_timezone: [
              { timezone: 'UTC-8', sent: 12000, opened: 3120, rate: 26.0 },
              { timezone: 'UTC-5', sent: 15000, opened: 3900, rate: 26.0 },
              { timezone: 'UTC+0', sent: 8000, opened: 2200, rate: 27.5 },
              { timezone: 'UTC+1', sent: 6000, opened: 1380, rate: 23.0 }
            ],
            top_performing_region: {
              name: 'United Kingdom',
              rate: 27.5,
              engagement_score: 85
            }
          })
        })
      })

      await page.goto('/analytics/geographic')
      
      // Verify geographic breakdown
      await campaignPage.expectText('[data-testid="top-country"]', 'United Kingdom')
      await campaignPage.expectText('[data-testid="top-country-rate"]', '27.5%')
      
      // Verify geographic table
      await campaignPage.expectVisible('[data-testid="geographic-table"]')
      await expect(page.locator('[data-testid="geographic-table"]')).toContainText('United States')
      await expect(page.locator('[data-testid="geographic-table"]')).toContainText('26.0%')
      
      // Verify world map visualization
      await campaignPage.expectVisible('[data-testid="world-map"]')
    })

    test('should track A/B test performance', async ({ page }) => {
      // Mock A/B test results
      await page.route('**/api/analytics/ab-tests', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            active_tests: [
              {
                id: 'test_subject_lines',
                name: 'Subject Line Test',
                type: 'subject_line',
                variants: [
                  { name: 'A', subject: 'Quick question about [Company]', sent: 500, opened: 125, rate: 25.0 },
                  { name: 'B', subject: 'Partnership opportunity with [Company]', sent: 500, opened: 145, rate: 29.0 }
                ],
                winner: 'B',
                confidence: 95,
                improvement: 16.0,
                status: 'completed'
              }
            ],
            recommendations: [
              {
                test_type: 'send_time',
                suggestion: 'Test sending emails at 9 AM vs 2 PM',
                potential_improvement: '12-18%'
              }
            ]
          })
        })
      })

      await page.goto('/analytics/ab-tests')
      
      // Verify A/B test results
      await campaignPage.expectVisible('[data-testid="ab-test-results"]')
      await campaignPage.expectText('[data-testid="winning-variant"]', 'Variant B')
      await campaignPage.expectText('[data-testid="improvement"]', '16.0%')
      await campaignPage.expectText('[data-testid="confidence"]', '95%')
      
      // Verify test recommendations
      await campaignPage.expectVisible('[data-testid="test-recommendations"]')
      await expect(page.locator('[data-testid="test-recommendations"]')).toContainText('send_time')
    })
  })

  test.describe('Performance Optimization', () => {
    test('should optimize email content based on performance data', async ({ page }) => {
      // Mock content optimization suggestions
      await page.route('**/api/optimization/content-suggestions', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            suggestions: [
              {
                type: 'subject_line',
                current: 'Partnership Opportunity',
                suggested: 'Quick question about [Company]',
                expected_improvement: '15%',
                reason: 'Shorter subject lines perform better in your campaigns'
              },
              {
                type: 'email_length',
                current: 'long',
                suggested: 'medium',
                expected_improvement: '8%',
                reason: 'Medium-length emails show higher engagement'
              },
              {
                type: 'cta_placement',
                current: 'bottom',
                suggested: 'middle',
                expected_improvement: '12%',
                reason: 'CTAs in middle of email get more clicks'
              }
            ],
            overall_score: 72,
            potential_improvement: '25%'
          })
        })
      })

      await page.goto('/optimization/content')
      
      // Verify optimization suggestions
      await campaignPage.expectVisible('[data-testid="content-optimization"]')
      await campaignPage.expectText('[data-testid="current-score"]', '72')
      await campaignPage.expectText('[data-testid="potential-improvement"]', '25%')
      
      // Verify specific suggestions
      await expect(page.locator('[data-testid="suggestions"]')).toContainText('Shorter subject lines')
      await expect(page.locator('[data-testid="suggestions"]')).toContainText('Medium-length emails')
      await expect(page.locator('[data-testid="suggestions"]')).toContainText('CTAs in middle')
      
      // Test applying suggestions
      await page.click('button[data-testid="apply-suggestion-subject_line"]')
      await campaignPage.expectText('[data-testid="success-message"]', 'Suggestion applied')
    })

    test('should recommend optimal sending times', async ({ page }) => {
      // Mock send time optimization
      await page.route('**/api/optimization/send-times', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            optimal_times: {
              global: {
                best_hour: 9,
                best_day: 'Tuesday',
                engagement_rate: 28.5
              },
              by_audience_segment: [
                {
                  segment: 'C-Level Executives',
                  best_hour: 7,
                  best_day: 'Monday',
                  engagement_rate: 31.2
                },
                {
                  segment: 'Marketing Managers',
                  best_hour: 10,
                  best_day: 'Wednesday',
                  engagement_rate: 26.8
                }
              ]
            },
            timezone_considerations: {
              primary_timezone: 'UTC-5',
              coverage: 65,
              recommendation: 'Optimize for Eastern Time'
            }
          })
        })
      })

      await page.goto('/optimization/send-times')
      
      // Verify send time recommendations
      await campaignPage.expectText('[data-testid="optimal-hour"]', '9 AM')
      await campaignPage.expectText('[data-testid="optimal-day"]', 'Tuesday')
      await campaignPage.expectText('[data-testid="optimal-rate"]', '28.5%')
      
      // Verify segment-specific recommendations
      await campaignPage.expectVisible('[data-testid="segment-recommendations"]')
      await expect(page.locator('[data-testid="segment-recommendations"]')).toContainText('C-Level Executives')
      await expect(page.locator('[data-testid="segment-recommendations"]')).toContainText('7 AM')
      
      // Test applying recommendations
      await page.click('button[data-testid="apply-optimal-schedule"]')
      await campaignPage.expectText('[data-testid="schedule-updated"]', 'Campaign schedule optimized')
    })

    test('should handle performance regression detection', async ({ page }) => {
      // Mock performance regression analysis
      await page.route('**/api/analytics/regression-analysis', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            regressions_detected: [
              {
                metric: 'open_rate',
                current_value: 18.5,
                previous_value: 25.3,
                change_percent: -26.9,
                timeframe: 'last_7_days',
                potential_causes: [
                  'Change in subject line style',
                  'Increased sending frequency',
                  'Domain reputation issue'
                ],
                severity: 'high'
              },
              {
                metric: 'click_rate',
                current_value: 5.2,
                previous_value: 7.6,
                change_percent: -31.6,
                timeframe: 'last_7_days',
                potential_causes: [
                  'CTA button placement change',
                  'Email content length increase'
                ],
                severity: 'medium'
              }
            ],
            recommendations: [
              'Revert to previous subject line format',
              'Reduce sending frequency by 30%',
              'Check domain reputation score'
            ]
          })
        })
      })

      await page.goto('/analytics/performance-alerts')
      
      // Verify regression detection
      await campaignPage.expectVisible('[data-testid="performance-regressions"]')
      await campaignPage.expectText('[data-testid="open-rate-regression"]', '-26.9%')
      await campaignPage.expectText('[data-testid="click-rate-regression"]', '-31.6%')
      
      // Verify severity indicators
      await campaignPage.expectVisible('[data-testid="high-severity-alert"]')
      await campaignPage.expectVisible('[data-testid="medium-severity-alert"]')
      
      // Verify recommendations
      await expect(page.locator('[data-testid="regression-recommendations"]')).toContainText('Revert to previous subject line')
      await expect(page.locator('[data-testid="regression-recommendations"]')).toContainText('Reduce sending frequency')
    })
  })

  test.describe('Visual Regression', () => {
    test('should match visual snapshots for email performance pages', async ({ page }) => {
      const performancePages = [
        { url: '/analytics/email-performance', name: 'email-performance-overview' },
        { url: '/analytics/delivery-tracking', name: 'delivery-tracking' },
        { url: '/analytics/bounce-analysis', name: 'bounce-analysis' },
        { url: '/analytics/reply-detection', name: 'reply-detection' },
        { url: '/optimization/content', name: 'content-optimization' }
      ]
      
      for (const pageInfo of performancePages) {
        await page.goto(pageInfo.url)
        await page.waitForLoadState('networkidle')
        await visualRegressionHelpers.takeScreenshot(page, pageInfo.name)
      }
    })

    test('should test responsive design for analytics dashboards', async ({ page }) => {
      await visualRegressionHelpers.testResponsive(
        page,
        '/analytics/email-performance',
        'email-analytics-responsive'
      )
    })
  })

  test.describe('Performance and Load Testing', () => {
    test('should handle real-time analytics updates efficiently', async ({ page }) => {
      let updateCount = 0
      await page.route('**/api/analytics/real-time-updates', async (route) => {
        updateCount++
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            timestamp: new Date().toISOString(),
            updates: {
              emails_sent: 1000 + updateCount * 50,
              emails_opened: 250 + updateCount * 12,
              emails_clicked: 75 + updateCount * 3
            }
          })
        })
      })

      await page.goto('/analytics/real-time')
      
      // Wait for multiple updates
      await page.waitForTimeout(5000)
      
      // Verify updates are being received
      expect(updateCount).toBeGreaterThan(3)
      
      // Verify UI reflects real-time data
      const emailsSent = await page.locator('[data-testid="real-time-sent"]').textContent()
      expect(parseInt(emailsSent?.replace(/[^0-9]/g, '') || '0')).toBeGreaterThan(1000)
    })

    test('should efficiently render large datasets in analytics tables', async ({ page }) => {
      // Mock large analytics dataset
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        email: `user${i}@example.com`,
        sent_at: '2024-01-01T10:00:00Z',
        opened_at: i % 4 === 0 ? '2024-01-01T10:30:00Z' : null,
        clicked_at: i % 10 === 0 ? '2024-01-01T10:45:00Z' : null
      }))

      await page.route('**/api/analytics/detailed-tracking', async (route) => {
        const url = new URL(route.request().url())
        const page_num = parseInt(url.searchParams.get('page') || '1')
        const page_size = parseInt(url.searchParams.get('page_size') || '100')
        
        const start = (page_num - 1) * page_size
        const end = start + page_size
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: largeDataset.slice(start, end),
            total: largeDataset.length,
            page: page_num,
            page_size
          })
        })
      })

      const startTime = Date.now()
      await page.goto('/analytics/detailed-tracking')
      await page.waitForSelector('[data-testid="tracking-table"]')
      const loadTime = Date.now() - startTime

      expect(loadTime).toBeLessThan(5000) // Should load within 5 seconds
      
      // Verify pagination is working (not rendering all 10k rows)
      const visibleRows = await page.locator('[data-testid="tracking-row"]').count()
      expect(visibleRows).toBeLessThanOrEqual(100)
    })
  })
})