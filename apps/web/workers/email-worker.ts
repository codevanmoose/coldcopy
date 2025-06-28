#!/usr/bin/env node

/**
 * Email Worker
 * Processes email-related background jobs
 */

import { emailQueue, JobType } from '../src/lib/queue';
import { sendTransactionalEmail, sendCampaignEmail } from '../src/lib/email/send';
import { processEmailWebhook } from '../src/lib/email/webhooks';
import { warmupEmail } from '../src/lib/email/warmup';
import { createClient } from '../src/lib/supabase/server';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Worker configuration
const CONCURRENCY = parseInt(process.env.EMAIL_WORKER_CONCURRENCY || '5');
const MAX_EMAILS_PER_MINUTE = parseInt(process.env.MAX_EMAILS_PER_MINUTE || '100');

// Rate limiting
let emailsSentInLastMinute = 0;
let lastMinuteReset = Date.now();

// Reset counter every minute
setInterval(() => {
  emailsSentInLastMinute = 0;
  lastMinuteReset = Date.now();
}, 60000);

// Process send-email jobs
emailQueue.process(JobType.SEND_EMAIL, CONCURRENCY, async (job) => {
  const { to, subject, html, text, campaignId, metadata } = job.data;
  
  try {
    // Rate limiting check
    if (emailsSentInLastMinute >= MAX_EMAILS_PER_MINUTE) {
      // Delay job
      await job.moveToDelayed(Date.now() + 60000);
      return { delayed: true, reason: 'rate_limit' };
    }
    
    // Update progress
    await job.progress(10);
    
    // Send email
    const result = await sendTransactionalEmail({
      to,
      subject,
      html,
      text,
      metadata,
    });
    
    await job.progress(50);
    
    // Record in database
    if (campaignId) {
      const supabase = createClient();
      await supabase
        .from('campaign_emails')
        .update({
          status: result.success ? 'sent' : 'failed',
          sent_at: new Date().toISOString(),
          message_id: result.messageId,
          error: result.error,
        })
        .eq('id', metadata?.emailId);
    }
    
    await job.progress(90);
    
    // Increment rate limit counter
    emailsSentInLastMinute++;
    
    await job.progress(100);
    
    return {
      success: result.success,
      messageId: result.messageId,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Send email error:', error);
    throw error;
  }
});

// Process bulk email jobs
emailQueue.process(JobType.SEND_BULK_EMAIL, 1, async (job) => {
  const { campaignId, emails, template } = job.data;
  const batchSize = 50;
  let sent = 0;
  let failed = 0;
  
  try {
    const supabase = createClient();
    
    // Process in batches
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
      // Send batch
      const results = await Promise.allSettled(
        batch.map(email => 
          sendCampaignEmail({
            campaignId,
            leadId: email.leadId,
            to: email.to,
            subject: template.subject,
            html: template.html,
            text: template.text,
          })
        )
      );
      
      // Count results
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value.success) {
          sent++;
        } else {
          failed++;
        }
      });
      
      // Update progress
      const progress = Math.round(((i + batch.length) / emails.length) * 100);
      await job.progress(progress);
      
      // Update campaign stats
      await supabase
        .from('campaigns')
        .update({
          emails_sent: sent,
          emails_failed: failed,
          last_sent_at: new Date().toISOString(),
        })
        .eq('id', campaignId);
      
      // Rate limiting pause
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return {
      campaignId,
      sent,
      failed,
      total: emails.length,
    };
  } catch (error) {
    console.error('Bulk email error:', error);
    throw error;
  }
});

// Process webhook jobs
emailQueue.process(JobType.PROCESS_WEBHOOK, CONCURRENCY * 2, async (job) => {
  const { type, payload } = job.data;
  
  try {
    await job.progress(20);
    
    const result = await processEmailWebhook(type, payload);
    
    await job.progress(80);
    
    // Update email status based on webhook
    if (result.messageId) {
      const supabase = createClient();
      
      const updateData: any = {};
      
      switch (type) {
        case 'bounce':
          updateData.status = 'bounced';
          updateData.bounce_type = result.bounceType;
          break;
        case 'complaint':
          updateData.status = 'complained';
          break;
        case 'delivery':
          updateData.status = 'delivered';
          updateData.delivered_at = new Date().toISOString();
          break;
      }
      
      if (Object.keys(updateData).length > 0) {
        await supabase
          .from('campaign_emails')
          .update(updateData)
          .eq('message_id', result.messageId);
      }
    }
    
    await job.progress(100);
    
    return result;
  } catch (error) {
    console.error('Webhook processing error:', error);
    throw error;
  }
});

// Process email warmup jobs
emailQueue.process(JobType.WARM_EMAIL, 2, async (job) => {
  const { warmupId, accountId, recipientId } = job.data;
  
  try {
    await job.progress(10);
    
    const result = await warmupEmail({
      warmupId,
      accountId,
      recipientId,
    });
    
    await job.progress(50);
    
    // Record warmup email
    const supabase = createClient();
    await supabase
      .from('warmup_emails')
      .insert({
        warmup_id: warmupId,
        account_id: accountId,
        recipient_id: recipientId,
        message_id: result.messageId,
        sent_at: new Date().toISOString(),
      });
    
    await job.progress(100);
    
    return result;
  } catch (error) {
    console.error('Email warmup error:', error);
    throw error;
  }
});

// Health check endpoint
import express from 'express';
const app = express();
const PORT = process.env.WORKER_PORT || 3001;

app.get('/health', async (req, res) => {
  try {
    const metrics = await emailQueue.getJobCounts();
    const isPaused = await emailQueue.isPaused();
    
    res.json({
      status: 'healthy',
      worker: 'email',
      concurrency: CONCURRENCY,
      queue: {
        ...metrics,
        isPaused,
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Email worker health endpoint listening on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing email worker...');
  
  // Stop accepting new jobs
  await emailQueue.pause(true, false);
  
  // Wait for current jobs to complete (max 30 seconds)
  let activeCount = await emailQueue.getActiveCount();
  let waited = 0;
  
  while (activeCount > 0 && waited < 30000) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    activeCount = await emailQueue.getActiveCount();
    waited += 1000;
  }
  
  // Close queue
  await emailQueue.close();
  
  process.exit(0);
});

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

console.log(`Email worker started with concurrency: ${CONCURRENCY}`);
console.log(`Rate limit: ${MAX_EMAILS_PER_MINUTE} emails/minute`);