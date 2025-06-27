import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { LinkedInClient } from './client';
import { LinkedInProfile, LinkedInMessage, LinkedInSyncJob } from './types';

export class LinkedInService {
  private workspaceId: string;
  private client: LinkedInClient;
  
  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
    this.client = new LinkedInClient(workspaceId);
  }
  
  /**
   * Enrich a lead with LinkedIn data
   */
  async enrichLead(leadId: string, linkedInUrl?: string): Promise<LinkedInProfile | null> {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);
    
    try {
      // Extract LinkedIn ID from URL if provided
      let linkedInUserId: string | null = null;
      if (linkedInUrl) {
        const match = linkedInUrl.match(/linkedin\.com\/in\/([^\/\?]+)/);
        if (match) {
          linkedInUserId = match[1];
        }
      }
      
      if (!linkedInUserId) {
        // Try to find by email or name from lead data
        const { data: lead } = await supabase
          .from('leads')
          .select('email, first_name, last_name, company')
          .eq('id', leadId)
          .single();
          
        if (!lead) {
          throw new Error('Lead not found');
        }
        
        // Search for profile (requires search API access)
        const searchQuery = `${lead.first_name} ${lead.last_name} ${lead.company || ''}`.trim();
        const searchResults = await this.client.searchProfiles(searchQuery, 1);
        
        if (searchResults.profiles.length === 0) {
          return null;
        }
        
        linkedInUserId = searchResults.profiles[0].id;
      }
      
      // Get full profile data
      const profile = await this.client.getProfile(linkedInUserId);
      
      // Save to database
      const { data: savedProfile, error } = await supabase
        .from('linkedin_profiles')
        .upsert({
          workspace_id: this.workspaceId,
          lead_id: leadId,
          linkedin_user_id: profile.id,
          profile_url: profile.publicProfileUrl || `https://linkedin.com/in/${profile.vanityName}`,
          public_identifier: profile.vanityName,
          full_name: `${profile.localizedFirstName} ${profile.localizedLastName}`,
          first_name: profile.localizedFirstName,
          last_name: profile.localizedLastName,
          headline: profile.localizedHeadline,
          profile_data: profile,
          last_enriched_at: new Date().toISOString(),
        }, {
          onConflict: 'workspace_id,linkedin_user_id',
        })
        .select()
        .single();
        
      if (error) {
        console.error('Error saving LinkedIn profile:', error);
        throw error;
      }
      
      // Update lead with LinkedIn URL
      if (savedProfile?.profile_url) {
        await supabase
          .from('leads')
          .update({
            linkedin_url: savedProfile.profile_url,
            updated_at: new Date().toISOString(),
          })
          .eq('id', leadId);
      }
      
      return savedProfile;
    } catch (error) {
      console.error('LinkedIn enrichment error:', error);
      return null;
    }
  }
  
  /**
   * Send a LinkedIn message
   */
  async sendMessage(
    leadId: string,
    content: string,
    messageType: 'connection_request' | 'inmail' | 'message',
    campaignId?: string
  ): Promise<LinkedInMessage> {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);
    
    // Get LinkedIn profile for the lead
    const { data: profile } = await supabase
      .from('linkedin_profiles')
      .select('*')
      .eq('lead_id', leadId)
      .eq('workspace_id', this.workspaceId)
      .single();
      
    if (!profile) {
      throw new Error('LinkedIn profile not found for lead');
    }
    
    // Check daily limits
    const { data: integration } = await supabase
      .from('linkedin_integrations')
      .select('daily_connection_limit, daily_message_limit')
      .eq('workspace_id', this.workspaceId)
      .single();
      
    if (!integration) {
      throw new Error('LinkedIn integration not found');
    }
    
    // Count today's messages
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { count: messagesSentToday } = await supabase
      .from('linkedin_messages')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', this.workspaceId)
      .gte('sent_at', today.toISOString())
      .in('status', ['sent', 'delivered', 'read', 'replied']);
      
    const limit = messageType === 'connection_request' 
      ? integration.daily_connection_limit 
      : integration.daily_message_limit;
      
    if (messagesSentToday && messagesSentToday >= limit) {
      throw new Error(`Daily ${messageType} limit reached`);
    }
    
    // Create message record
    const { data: message, error: messageError } = await supabase
      .from('linkedin_messages')
      .insert({
        workspace_id: this.workspaceId,
        campaign_id: campaignId,
        lead_id: leadId,
        profile_id: profile.id,
        message_type: messageType,
        content,
        status: 'scheduled',
      })
      .select()
      .single();
      
    if (messageError) {
      throw messageError;
    }
    
    try {
      // Send via LinkedIn API
      if (messageType === 'connection_request') {
        const result = await this.client.sendConnectionRequest({
          recipientUrn: `urn:li:person:${profile.linkedin_user_id}`,
          message: content,
        });
        
        // Update message with LinkedIn ID
        await supabase
          .from('linkedin_messages')
          .update({
            linkedin_message_id: result.id,
            status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .eq('id', message.id);
          
        // Update profile
        await supabase
          .from('linkedin_profiles')
          .update({
            connection_request_sent_at: new Date().toISOString(),
          })
          .eq('id', profile.id);
          
      } else {
        const result = await this.client.sendMessage({
          recipientUrn: `urn:li:person:${profile.linkedin_user_id}`,
          body: content,
          messageType: messageType === 'inmail' ? 'INMAIL' : 'MESSAGE',
        });
        
        // Update message with LinkedIn ID
        await supabase
          .from('linkedin_messages')
          .update({
            linkedin_message_id: result.id,
            status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .eq('id', message.id);
          
        // Update profile
        await supabase
          .from('linkedin_profiles')
          .update({
            last_message_sent_at: new Date().toISOString(),
          })
          .eq('id', profile.id);
      }
      
      return { ...message, status: 'sent' };
      
    } catch (error) {
      // Update message with error
      await supabase
        .from('linkedin_messages')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          retry_count: message.retry_count + 1,
        })
        .eq('id', message.id);
        
      throw error;
    }
  }
  
  /**
   * Sync LinkedIn connections
   */
  async syncConnections(): Promise<LinkedInSyncJob> {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);
    
    // Create sync job
    const { data: job, error: jobError } = await supabase
      .from('linkedin_sync_jobs')
      .insert({
        workspace_id: this.workspaceId,
        job_type: 'connection_sync',
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();
      
    if (jobError) {
      throw jobError;
    }
    
    try {
      let totalConnections = 0;
      let processedConnections = 0;
      let hasMore = true;
      let start = 0;
      const batchSize = 50;
      
      while (hasMore) {
        const { connections, paging } = await this.client.getConnections(start, batchSize);
        
        for (const connection of connections) {
          try {
            // Save or update profile
            await supabase
              .from('linkedin_profiles')
              .upsert({
                workspace_id: this.workspaceId,
                linkedin_user_id: connection.id,
                profile_url: connection.publicProfileUrl,
                public_identifier: connection.vanityName,
                full_name: `${connection.localizedFirstName} ${connection.localizedLastName}`,
                first_name: connection.localizedFirstName,
                last_name: connection.localizedLastName,
                headline: connection.localizedHeadline,
                is_connected: true,
                connection_degree: 1,
                profile_data: connection,
                last_enriched_at: new Date().toISOString(),
              }, {
                onConflict: 'workspace_id,linkedin_user_id',
              });
              
            processedConnections++;
          } catch (error) {
            console.error('Error syncing connection:', error);
          }
        }
        
        totalConnections = paging.total;
        start += batchSize;
        hasMore = start < totalConnections;
        
        // Update job progress
        await supabase
          .from('linkedin_sync_jobs')
          .update({
            total_items: totalConnections,
            processed_items: start,
            successful_items: processedConnections,
          })
          .eq('id', job.id);
      }
      
      // Complete job
      const { data: completedJob } = await supabase
        .from('linkedin_sync_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          total_items: totalConnections,
          processed_items: processedConnections,
          successful_items: processedConnections,
        })
        .eq('id', job.id)
        .select()
        .single();
        
      return completedJob!;
      
    } catch (error) {
      // Mark job as failed
      await supabase
        .from('linkedin_sync_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          errors: [{ message: error instanceof Error ? error.message : 'Unknown error' }],
        })
        .eq('id', job.id);
        
      throw error;
    }
  }
  
  /**
   * Get LinkedIn engagement metrics
   */
  async getEngagementMetrics(startDate?: Date, endDate?: Date) {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);
    
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const end = endDate || new Date();
    
    // Get message statistics
    const { data: messageStats } = await supabase
      .from('linkedin_messages')
      .select('status, message_type')
      .eq('workspace_id', this.workspaceId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());
      
    // Calculate metrics
    const metrics = {
      connectionRequestsSent: 0,
      connectionRequestsAccepted: 0,
      messagesSent: 0,
      messagesDelivered: 0,
      messagesRead: 0,
      messagesReplied: 0,
      profileViews: 0,
      clickThroughRate: 0,
      responseRate: 0,
      connectionAcceptanceRate: 0,
    };
    
    if (messageStats) {
      messageStats.forEach(msg => {
        if (msg.message_type === 'connection_request') {
          metrics.connectionRequestsSent++;
          if (msg.status === 'replied') {
            metrics.connectionRequestsAccepted++;
          }
        } else {
          if (['sent', 'delivered', 'read', 'replied'].includes(msg.status)) {
            metrics.messagesSent++;
          }
          if (['delivered', 'read', 'replied'].includes(msg.status)) {
            metrics.messagesDelivered++;
          }
          if (['read', 'replied'].includes(msg.status)) {
            metrics.messagesRead++;
          }
          if (msg.status === 'replied') {
            metrics.messagesReplied++;
          }
        }
      });
      
      // Calculate rates
      if (metrics.messagesSent > 0) {
        metrics.responseRate = (metrics.messagesReplied / metrics.messagesSent) * 100;
      }
      if (metrics.connectionRequestsSent > 0) {
        metrics.connectionAcceptanceRate = (metrics.connectionRequestsAccepted / metrics.connectionRequestsSent) * 100;
      }
    }
    
    return metrics;
  }
}