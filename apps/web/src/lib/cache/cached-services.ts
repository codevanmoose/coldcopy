import { createClient } from '@/utils/supabase/server';
import { cache, cacheKeys, Cacheable, InvalidateCache } from './redis';
import { Lead, Campaign, CampaignEmail } from '@/types';

/**
 * Cached Lead Service
 */
export class CachedLeadService {
  /**
   * Get lead by ID with caching
   */
  @Cacheable({ ttl: 3600 }) // 1 hour
  static async getLeadById(leadId: string): Promise<Lead | null> {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (error) {
      console.error('Error fetching lead:', error);
      return null;
    }

    return data;
  }

  /**
   * Get leads by workspace with pagination caching
   */
  static async getLeadsByWorkspace(
    workspaceId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ leads: Lead[]; total: number }> {
    const cacheKey = cacheKeys.leadsByWorkspace(workspaceId, page);
    
    // Try cache first
    const cached = await cache.get<{ leads: Lead[]; total: number }>(cacheKey);
    if (cached) return cached;

    // Fetch from database
    const supabase = createClient();
    const offset = (page - 1) * limit;

    const [{ data: leads, error: leadsError }, { count, error: countError }] = await Promise.all([
      supabase
        .from('leads')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),
      supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
    ]);

    if (leadsError || countError) {
      console.error('Error fetching leads:', leadsError || countError);
      return { leads: [], total: 0 };
    }

    const result = { leads: leads || [], total: count || 0 };
    
    // Cache for 5 minutes
    await cache.set(cacheKey, result, { ttl: 300 });
    
    return result;
  }

  /**
   * Get lead enrichment data with caching
   */
  @Cacheable({ ttl: 86400 }) // 24 hours
  static async getLeadEnrichment(leadId: string): Promise<any> {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('leads')
      .select('enrichment_data')
      .eq('id', leadId)
      .single();

    if (error || !data) return null;
    
    return data.enrichment_data;
  }

  /**
   * Create or update lead with cache invalidation
   */
  @InvalidateCache(['leads:workspace:*', 'analytics:workspace:*'])
  static async upsertLead(lead: Partial<Lead>): Promise<Lead | null> {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('leads')
      .upsert(lead)
      .select()
      .single();

    if (error) {
      console.error('Error upserting lead:', error);
      return null;
    }

    // Invalidate specific lead cache
    if (data.id) {
      await cache.delete(cacheKeys.lead(data.id));
    }

    return data;
  }
}

/**
 * Cached Campaign Service
 */
export class CachedCampaignService {
  /**
   * Get campaign with performance data
   */
  static async getCampaignWithPerformance(campaignId: string): Promise<any> {
    const cacheKey = cacheKeys.campaignPerformance(campaignId);
    
    // Try cache first
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    // Fetch from materialized view
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('mv_campaign_performance')
      .select('*')
      .eq('campaign_id', campaignId)
      .single();

    if (error) {
      console.error('Error fetching campaign performance:', error);
      
      // Fallback to regular query
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();
      
      return campaign;
    }

    // Cache for 1 hour (materialized view is refreshed hourly)
    await cache.set(cacheKey, data, { ttl: 3600 });
    
    return data;
  }

  /**
   * Get campaigns by workspace
   */
  @Cacheable({ ttl: 600 }) // 10 minutes
  static async getCampaignsByWorkspace(workspaceId: string): Promise<Campaign[]> {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching campaigns:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Update campaign with cache invalidation
   */
  static async updateCampaign(
    campaignId: string,
    updates: Partial<Campaign>
  ): Promise<Campaign | null> {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('campaigns')
      .update(updates)
      .eq('id', campaignId)
      .select()
      .single();

    if (error) {
      console.error('Error updating campaign:', error);
      return null;
    }

    // Invalidate related caches
    await cache.delete([
      cacheKeys.campaign(campaignId),
      cacheKeys.campaignPerformance(campaignId),
      cacheKeys.campaignsByWorkspace(data.workspace_id),
    ]);

    return data;
  }
}

/**
 * Cached Analytics Service
 */
export class CachedAnalyticsService {
  /**
   * Get workspace analytics
   */
  static async getWorkspaceAnalytics(
    workspaceId: string,
    period: string = 'last_30_days'
  ): Promise<any> {
    const cacheKey = cacheKeys.workspaceAnalytics(workspaceId, period);
    
    // Try cache first
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    // Fetch from materialized view
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('mv_workspace_usage')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single();

    if (error) {
      console.error('Error fetching workspace analytics:', error);
      return null;
    }

    // Calculate period-specific metrics
    const analytics = {
      ...data,
      period,
      // Add calculated metrics based on period
    };

    // Cache for 30 minutes
    await cache.set(cacheKey, analytics, { ttl: 1800 });
    
    return analytics;
  }

  /**
   * Get lead engagement scores
   */
  static async getLeadEngagement(leadId: string): Promise<any> {
    const cacheKey = cacheKeys.leadEngagement(leadId);
    
    // Try cache first
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    // Fetch from materialized view
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('mv_lead_engagement')
      .select('*')
      .eq('lead_id', leadId)
      .single();

    if (error) {
      console.error('Error fetching lead engagement:', error);
      return null;
    }

    // Cache for 2 hours (materialized view is refreshed every 2 hours)
    await cache.set(cacheKey, data, { ttl: 7200 });
    
    return data;
  }

  /**
   * Get deliverability metrics
   */
  @Cacheable({ ttl: 14400 }) // 4 hours
  static async getDeliverabilityMetrics(workspaceId: string): Promise<any> {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('mv_deliverability_summary')
      .select('*')
      .eq('workspace_id', workspaceId);

    if (error) {
      console.error('Error fetching deliverability metrics:', error);
      return [];
    }

    return data || [];
  }
}

/**
 * Cached AI Response Service
 */
export class CachedAIService {
  /**
   * Get AI response with caching
   */
  static async getAIResponse(
    prompt: string,
    model: string = 'gpt-4-turbo-preview',
    options: any = {}
  ): Promise<string | null> {
    const cacheKey = cacheKeys.aiResponse(prompt, model);
    
    // Check cache for similar prompts
    const cached = await cache.get<string>(cacheKey);
    if (cached) return cached;

    // Generate new response (implementation depends on your AI service)
    // This is a placeholder - replace with actual AI call
    const response = await generateAIResponse(prompt, model, options);
    
    if (response) {
      // Cache for 7 days
      await cache.set(cacheKey, response, { ttl: 604800, compress: true });
    }

    return response;
  }
}

/**
 * Cache warming service
 */
export class CacheWarmingService {
  /**
   * Warm critical caches for a workspace
   */
  static async warmWorkspaceCaches(workspaceId: string): Promise<void> {
    const promises = [
      // Warm campaign caches
      CachedCampaignService.getCampaignsByWorkspace(workspaceId),
      
      // Warm analytics caches
      CachedAnalyticsService.getWorkspaceAnalytics(workspaceId),
      
      // Warm first page of leads
      CachedLeadService.getLeadsByWorkspace(workspaceId, 1),
    ];

    await Promise.all(promises);
  }

  /**
   * Warm caches after data changes
   */
  static async warmAfterUpdate(
    type: 'lead' | 'campaign' | 'analytics',
    workspaceId: string,
    entityId?: string
  ): Promise<void> {
    switch (type) {
      case 'lead':
        if (entityId) {
          await CachedLeadService.getLeadById(entityId);
          await CachedAnalyticsService.getLeadEngagement(entityId);
        }
        break;
        
      case 'campaign':
        if (entityId) {
          await CachedCampaignService.getCampaignWithPerformance(entityId);
        }
        await CachedCampaignService.getCampaignsByWorkspace(workspaceId);
        break;
        
      case 'analytics':
        await CachedAnalyticsService.getWorkspaceAnalytics(workspaceId);
        break;
    }
  }
}

// Placeholder for AI response generation
async function generateAIResponse(
  prompt: string,
  model: string,
  options: any
): Promise<string> {
  // Replace with actual AI service call
  return `AI response for: ${prompt}`;
}