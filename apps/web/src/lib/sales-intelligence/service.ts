import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { 
  IntentSignal, 
  IntentScore, 
  WebsiteVisitor,
  CompanyEvent,
  CompanyTechStack,
  SignalType,
  RecommendedAction,
  BuyingSignalAlert,
  IntentDashboardMetrics
} from './types';

export class SalesIntelligenceService {
  private workspaceId: string;
  
  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
  }
  
  /**
   * Record a new intent signal
   */
  async recordSignal(signal: Omit<IntentSignal, 'id' | 'workspace_id' | 'created_at'>): Promise<IntentSignal> {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);
    
    const { data, error } = await supabase
      .from('intent_signals')
      .insert({
        ...signal,
        workspace_id: this.workspaceId,
      })
      .select()
      .single();
      
    if (error) {
      console.error('Error recording intent signal:', error);
      throw new Error('Failed to record intent signal');
    }
    
    // Check if this should trigger a campaign
    await this.checkIntentTriggers(signal.lead_id!);
    
    return data;
  }
  
  /**
   * Record a website visit
   */
  async recordWebsiteVisit(visit: Omit<WebsiteVisitor, 'id' | 'workspace_id' | 'visited_at'>): Promise<void> {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);
    
    // Record the visit
    const { error: visitError } = await supabase
      .from('website_visitors')
      .insert({
        ...visit,
        workspace_id: this.workspaceId,
      });
      
    if (visitError) {
      console.error('Error recording website visit:', visitError);
      throw new Error('Failed to record website visit');
    }
    
    // If we have a lead_id, create an intent signal
    if (visit.lead_id) {
      await this.recordSignal({
        lead_id: visit.lead_id,
        company_domain: visit.company_domain,
        signal_type: 'website_visit',
        signal_source: 'website_tracking',
        signal_strength: this.calculateVisitStrength(visit),
        title: `Visited ${visit.page_title || visit.page_url}`,
        description: `Spent ${visit.time_on_page || 0} seconds on page`,
        url: visit.page_url,
        metadata: {
          session_id: visit.session_id,
          utm_source: visit.utm_source,
          utm_medium: visit.utm_medium,
          utm_campaign: visit.utm_campaign,
          referrer: visit.referrer_url,
        },
        signal_date: new Date().toISOString(),
        detected_at: new Date().toISOString(),
        processed: false,
        campaign_triggered: false,
      });
    }
  }
  
  /**
   * Get intent score for a lead
   */
  async getIntentScore(leadId: string): Promise<IntentScore | null> {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);
    
    const { data, error } = await supabase
      .from('intent_scores')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .eq('lead_id', leadId)
      .single();
      
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching intent score:', error);
      throw new Error('Failed to fetch intent score');
    }
    
    return data;
  }
  
  /**
   * Get recent signals for a lead
   */
  async getLeadSignals(leadId: string, limit: number = 10): Promise<IntentSignal[]> {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);
    
    const { data, error } = await supabase
      .from('intent_signals')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .eq('lead_id', leadId)
      .order('signal_date', { ascending: false })
      .limit(limit);
      
    if (error) {
      console.error('Error fetching lead signals:', error);
      throw new Error('Failed to fetch lead signals');
    }
    
    return data || [];
  }
  
  /**
   * Get hot leads (high intent scores)
   */
  async getHotLeads(limit: number = 20): Promise<Array<{
    lead_id: string;
    score: IntentScore;
    recent_signals: IntentSignal[];
  }>> {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);
    
    // Get high-scoring leads
    const { data: scores, error: scoresError } = await supabase
      .from('intent_scores')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .eq('recommended_action', 'reach_out_now')
      .order('overall_score', { ascending: false })
      .limit(limit);
      
    if (scoresError) {
      console.error('Error fetching hot leads:', scoresError);
      throw new Error('Failed to fetch hot leads');
    }
    
    if (!scores || scores.length === 0) {
      return [];
    }
    
    // Get recent signals for each hot lead
    const hotLeads = await Promise.all(
      scores.map(async (score) => {
        const signals = await this.getLeadSignals(score.lead_id, 5);
        return {
          lead_id: score.lead_id,
          score,
          recent_signals: signals,
        };
      })
    );
    
    return hotLeads;
  }
  
  /**
   * Record a company event (funding, news, etc.)
   */
  async recordCompanyEvent(event: Omit<CompanyEvent, 'id' | 'workspace_id' | 'created_at'>): Promise<void> {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);
    
    // Insert the event
    const { error: eventError } = await supabase
      .from('company_events')
      .insert({
        ...event,
        workspace_id: this.workspaceId,
      });
      
    if (eventError) {
      console.error('Error recording company event:', eventError);
      throw new Error('Failed to record company event');
    }
    
    // Find leads associated with this company
    const { data: leads } = await supabase
      .from('leads')
      .select('id')
      .eq('workspace_id', this.workspaceId)
      .eq('company_domain', event.company_domain);
      
    if (leads && leads.length > 0) {
      // Create signals for each lead
      for (const lead of leads) {
        await this.recordSignal({
          lead_id: lead.id,
          company_domain: event.company_domain,
          signal_type: this.mapEventTypeToSignalType(event.event_type),
          signal_source: event.source,
          signal_strength: event.relevance_score,
          title: event.title,
          description: event.description,
          url: event.url,
          metadata: event.metadata,
          signal_date: event.event_date,
          detected_at: new Date().toISOString(),
          processed: false,
          campaign_triggered: false,
        });
      }
    }
  }
  
  /**
   * Update technology stack for a company
   */
  async updateTechStack(
    companyDomain: string, 
    technologies: Array<Omit<CompanyTechStack, 'id' | 'workspace_id' | 'created_at' | 'updated_at'>>
  ): Promise<void> {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);
    
    // Get existing tech stack
    const { data: existingTech } = await supabase
      .from('company_tech_stack')
      .select('technology_name')
      .eq('workspace_id', this.workspaceId)
      .eq('company_domain', companyDomain)
      .eq('is_active', true);
      
    const existingTechNames = new Set(existingTech?.map(t => t.technology_name) || []);
    const newTechNames = new Set(technologies.map(t => t.technology_name));
    
    // Find additions and removals
    const additions = technologies.filter(t => !existingTechNames.has(t.technology_name));
    const removals = Array.from(existingTechNames).filter(name => !newTechNames.has(name));
    
    // Mark removed technologies
    if (removals.length > 0) {
      await supabase
        .from('company_tech_stack')
        .update({
          is_active: false,
          is_removed: true,
          removed_at: new Date().toISOString(),
        })
        .eq('workspace_id', this.workspaceId)
        .eq('company_domain', companyDomain)
        .in('technology_name', removals);
    }
    
    // Add new technologies
    if (additions.length > 0) {
      await supabase
        .from('company_tech_stack')
        .upsert(
          additions.map(tech => ({
            ...tech,
            workspace_id: this.workspaceId,
            company_domain: companyDomain,
            is_new: true,
          })),
          { onConflict: 'workspace_id,company_domain,technology_name' }
        );
    }
    
    // Create signals for tech changes
    if (additions.length > 0 || removals.length > 0) {
      const { data: leads } = await supabase
        .from('leads')
        .select('id')
        .eq('workspace_id', this.workspaceId)
        .eq('company_domain', companyDomain);
        
      if (leads && leads.length > 0) {
        for (const lead of leads) {
          await this.recordSignal({
            lead_id: lead.id,
            company_domain: companyDomain,
            signal_type: 'tech_stack_change',
            signal_source: 'technographics',
            signal_strength: 70,
            title: 'Technology Stack Updated',
            description: `Added: ${additions.map(t => t.technology_name).join(', ') || 'None'}. Removed: ${removals.join(', ') || 'None'}`,
            metadata: {
              additions: additions.map(t => t.technology_name),
              removals,
            },
            signal_date: new Date().toISOString(),
            detected_at: new Date().toISOString(),
            processed: false,
            campaign_triggered: false,
          });
        }
      }
    }
  }
  
  /**
   * Get dashboard metrics
   */
  async getDashboardMetrics(): Promise<IntentDashboardMetrics> {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);
    
    // Get hot leads count
    const { count: hotLeadsCount } = await supabase
      .from('intent_scores')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', this.workspaceId)
      .eq('recommended_action', 'reach_out_now');
      
    // Get today's signals
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data: todaySignals } = await supabase
      .from('intent_signals')
      .select('signal_type, signal_strength')
      .eq('workspace_id', this.workspaceId)
      .gte('detected_at', today.toISOString());
      
    // Get average intent score
    const { data: avgScore } = await supabase
      .from('intent_scores')
      .select('overall_score')
      .eq('workspace_id', this.workspaceId);
      
    const averageScore = avgScore && avgScore.length > 0
      ? avgScore.reduce((sum, s) => sum + s.overall_score, 0) / avgScore.length
      : 0;
      
    // Get top signal types
    const signalTypeCounts = new Map<SignalType, { count: number; totalStrength: number }>();
    todaySignals?.forEach(signal => {
      const current = signalTypeCounts.get(signal.signal_type as SignalType) || { count: 0, totalStrength: 0 };
      signalTypeCounts.set(signal.signal_type as SignalType, {
        count: current.count + 1,
        totalStrength: current.totalStrength + signal.signal_strength,
      });
    });
    
    const topSignalTypes = Array.from(signalTypeCounts.entries())
      .map(([type, data]) => ({
        type,
        count: data.count,
        average_strength: Math.round(data.totalStrength / data.count),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
      
    // Get score distribution
    const scoreRanges = [
      { range: '0-20', min: 0, max: 20 },
      { range: '21-40', min: 21, max: 40 },
      { range: '41-60', min: 41, max: 60 },
      { range: '61-80', min: 61, max: 80 },
      { range: '81-100', min: 81, max: 100 },
    ];
    
    const scoreDistribution = await Promise.all(
      scoreRanges.map(async (range) => {
        const { count } = await supabase
          .from('intent_scores')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', this.workspaceId)
          .gte('overall_score', range.min)
          .lte('overall_score', range.max);
          
        return {
          range: range.range,
          count: count || 0,
        };
      })
    );
    
    // Get trending companies
    const { data: trendingScores } = await supabase
      .from('intent_scores')
      .select(`
        lead_id,
        overall_score,
        score_trend,
        recent_signal_count,
        leads!inner(company_domain, company_name)
      `)
      .eq('workspace_id', this.workspaceId)
      .eq('score_trend', 'rising')
      .order('overall_score', { ascending: false })
      .limit(10);
      
    const trendingCompanies = trendingScores?.map(score => ({
      domain: score.leads.company_domain,
      name: score.leads.company_name,
      score: score.overall_score,
      trend: score.score_trend,
      recent_signals: score.recent_signal_count,
    })) || [];
    
    return {
      hot_leads: hotLeadsCount || 0,
      total_signals_today: todaySignals?.length || 0,
      average_intent_score: Math.round(averageScore),
      top_signal_types: topSignalTypes,
      score_distribution: scoreDistribution,
      trending_companies: trendingCompanies,
    };
  }
  
  /**
   * Get buying signal alerts
   */
  async getBuyingSignalAlerts(limit: number = 10): Promise<BuyingSignalAlert[]> {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);
    
    const { data: signals } = await supabase
      .from('intent_signals')
      .select(`
        *,
        leads!inner(
          id,
          first_name,
          last_name,
          company_name
        ),
        intent_scores!inner(
          recommended_action
        )
      `)
      .eq('workspace_id', this.workspaceId)
      .eq('processed', false)
      .gte('signal_strength', 70)
      .order('detected_at', { ascending: false })
      .limit(limit);
      
    if (!signals) return [];
    
    return signals.map(signal => ({
      lead_id: signal.lead_id!,
      lead_name: `${signal.leads.first_name} ${signal.leads.last_name}`,
      company_name: signal.leads.company_name,
      signal_type: signal.signal_type as SignalType,
      signal_strength: signal.signal_strength,
      title: signal.title!,
      description: signal.description || '',
      recommended_action: signal.intent_scores.recommended_action as RecommendedAction,
      recommended_message: this.generateRecommendedMessage(signal),
      detected_at: signal.detected_at,
    }));
  }
  
  /**
   * Check and execute intent triggers
   */
  private async checkIntentTriggers(leadId: string): Promise<void> {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);
    
    // Get active triggers
    const { data: triggers } = await supabase
      .from('intent_triggers')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .eq('is_active', true);
      
    if (!triggers || triggers.length === 0) return;
    
    // Get lead's current score and signals
    const score = await this.getIntentScore(leadId);
    if (!score) return;
    
    const recentSignals = await this.getLeadSignals(leadId, 10);
    
    // Check each trigger
    for (const trigger of triggers) {
      // Check if daily limit is reached
      if (trigger.triggers_today >= trigger.max_triggers_per_day) continue;
      
      // Check if all conditions are met
      const conditionsMet = trigger.conditions.every(condition => {
        return this.evaluateCondition(condition, score, recentSignals);
      });
      
      if (conditionsMet) {
        // Execute trigger actions
        await this.executeTrigger(trigger, leadId, score);
      }
    }
  }
  
  /**
   * Helper: Calculate visit strength based on engagement
   */
  private calculateVisitStrength(visit: Partial<WebsiteVisitor>): number {
    let strength = 30; // Base strength
    
    // Add points for engagement
    if (visit.time_on_page && visit.time_on_page > 60) strength += 20;
    if (visit.time_on_page && visit.time_on_page > 180) strength += 10;
    if (visit.scroll_depth && visit.scroll_depth > 75) strength += 15;
    if (visit.clicks && visit.clicks.length > 2) strength += 10;
    if (visit.utm_campaign) strength += 10; // Came from a campaign
    if (!visit.is_new_visitor) strength += 5; // Returning visitor
    
    return Math.min(strength, 100);
  }
  
  /**
   * Helper: Map event types to signal types
   */
  private mapEventTypeToSignalType(eventType: string): SignalType {
    const mapping: Record<string, SignalType> = {
      funding_round: 'funding_announced',
      leadership_change: 'leadership_change',
      product_launch: 'product_launch',
      partnership: 'partnership_announcement',
      expansion: 'expansion_news',
    };
    
    return mapping[eventType] || 'social_engagement';
  }
  
  /**
   * Helper: Generate recommended message based on signal
   */
  private generateRecommendedMessage(signal: IntentSignal): string {
    const templates: Record<SignalType, string> = {
      website_visit: "I noticed you were checking out our {page_title}. I'd love to show you how we can help with {pain_point}.",
      funding_announced: "Congratulations on your recent funding! As you scale, we can help with {solution}.",
      leadership_change: "I saw the news about {leader_name} joining as {position}. We'd love to support your new initiatives.",
      tech_stack_change: "I noticed you recently added {technology}. We integrate seamlessly and can help maximize your investment.",
      hiring_surge: "Saw you're growing the team! We can help onboard your new {department} hires faster.",
      expansion_news: "Congratulations on expanding to {location}! We have experience helping companies scale globally.",
      partnership_announcement: "Great news about partnering with {partner}! We work with similar companies and can add value.",
      product_launch: "Your new {product} looks impressive! We can help you reach more customers.",
      content_download: "Thanks for downloading {content_title}. Based on your interest, I think you'd find value in {related_solution}.",
      competitor_research: "I see you're evaluating solutions in our space. Happy to show you what makes us different.",
      social_engagement: "Thanks for engaging with our content! Would love to continue the conversation.",
      search_intent: "I noticed you're researching {topic}. We've helped similar companies achieve {outcome}.",
    };
    
    return templates[signal.signal_type as SignalType] || "I noticed some interesting activity from your company. Would love to connect and see how we can help.";
  }
  
  /**
   * Helper: Evaluate trigger condition
   */
  private evaluateCondition(
    condition: any, 
    score: IntentScore, 
    signals: IntentSignal[]
  ): boolean {
    const value = this.getFieldValue(condition.field, score, signals);
    
    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'not_equals':
        return value !== condition.value;
      case 'greater_than':
        return value > condition.value;
      case 'less_than':
        return value < condition.value;
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(value);
      case 'contains':
        return String(value).includes(String(condition.value));
      default:
        return false;
    }
  }
  
  /**
   * Helper: Get field value for condition evaluation
   */
  private getFieldValue(field: string, score: IntentScore, signals: IntentSignal[]): any {
    // Score fields
    if (field in score) {
      return (score as any)[field];
    }
    
    // Signal fields
    if (field === 'signal_types') {
      return [...new Set(signals.map(s => s.signal_type))];
    }
    if (field === 'max_signal_strength') {
      return Math.max(...signals.map(s => s.signal_strength));
    }
    if (field === 'signal_count') {
      return signals.length;
    }
    
    return null;
  }
  
  /**
   * Helper: Execute trigger actions
   */
  private async executeTrigger(trigger: any, leadId: string, score: IntentScore): Promise<void> {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);
    
    // Record triggered campaign
    await supabase
      .from('intent_triggered_campaigns')
      .insert({
        workspace_id: this.workspaceId,
        trigger_id: trigger.id,
        lead_id: leadId,
        campaign_id: trigger.campaign_id,
        trigger_score: score.overall_score,
        trigger_conditions_met: trigger.conditions,
      });
      
    // Update trigger count
    await supabase
      .from('intent_triggers')
      .update({
        triggers_today: trigger.triggers_today + 1,
      })
      .eq('id', trigger.id);
      
    // TODO: Execute campaign, assign to user, add tags, send notification
  }
}