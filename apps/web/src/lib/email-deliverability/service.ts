import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import dns from 'dns/promises';

export interface SpamAnalysisResult {
  overall_spam_score: number;
  spam_triggers: string[];
  recommendations: string[];
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  content_analysis: {
    word_count: number;
    link_count: number;
    image_count: number;
    caps_percentage: number;
    exclamation_count: number;
    spam_word_count: number;
  };
  inbox_placement_prediction: {
    gmail: 'inbox' | 'promotions' | 'spam' | 'unknown';
    outlook: 'inbox' | 'junk' | 'focused' | 'other' | 'unknown';
    yahoo: 'inbox' | 'spam' | 'unknown';
  };
}

export interface DomainReputation {
  domain: string;
  spf_valid: boolean;
  dkim_valid: boolean;
  dmarc_valid: boolean;
  overall_score: number;
  blacklisted: boolean;
  delivery_rate: number;
  bounce_rate: number;
  complaint_rate: number;
}

export interface InboxPlacementTest {
  id: string;
  test_name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  inbox_rate: number;
  spam_rate: number;
  gmail_results: Record<string, number>;
  outlook_results: Record<string, number>;
  yahoo_results: Record<string, number>;
}

export class EmailDeliverabilityService {
  private workspaceId: string;
  
  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
  }
  
  /**
   * Analyze email content for spam
   */
  async analyzeSpamScore(
    subject: string,
    bodyHtml: string,
    bodyText: string,
    fromName?: string,
    fromEmail?: string
  ): Promise<SpamAnalysisResult> {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);
    
    // Basic content analysis
    const contentAnalysis = this.analyzeContent(subject, bodyHtml, bodyText);
    
    // Calculate spam score using database function
    const { data: scoreData } = await supabase
      .rpc('calculate_spam_score', {
        p_subject: subject,
        p_body_html: bodyHtml,
        p_body_text: bodyText,
      });
      
    const spamScore = scoreData?.[0]?.spam_score || 0;
    const spamTriggers = scoreData?.[0]?.spam_triggers || [];
    const recommendations = scoreData?.[0]?.recommendations || [];
    
    // Determine risk level
    const riskLevel = this.getRiskLevel(spamScore);
    
    // Predict inbox placement
    const inboxPlacement = this.predictInboxPlacement(spamScore, contentAnalysis);
    
    // Save analysis
    const { data: analysis } = await supabase
      .from('spam_analysis')
      .insert({
        workspace_id: this.workspaceId,
        subject,
        body_html: bodyHtml,
        body_text: bodyText,
        from_name: fromName,
        from_email: fromEmail,
        overall_spam_score: spamScore,
        spam_triggers: spamTriggers,
        content_analysis: contentAnalysis,
        recommendations,
        risk_level: riskLevel,
        ...contentAnalysis,
        gmail_placement: inboxPlacement.gmail,
        outlook_placement: inboxPlacement.outlook,
        yahoo_placement: inboxPlacement.yahoo,
      })
      .select()
      .single();
    
    return {
      overall_spam_score: spamScore,
      spam_triggers: spamTriggers,
      recommendations,
      risk_level: riskLevel,
      content_analysis: contentAnalysis,
      inbox_placement_prediction: inboxPlacement,
    };
  }
  
  /**
   * Check domain reputation and authentication
   */
  async checkDomainReputation(domain: string): Promise<DomainReputation> {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);
    
    // Check DNS records
    const authChecks = await this.checkEmailAuthentication(domain);
    
    // Check blacklists
    const blacklistStatus = await this.checkBlacklists(domain);
    
    // Get or create domain reputation record
    const { data: reputation } = await supabase
      .from('domain_reputation')
      .upsert({
        workspace_id: this.workspaceId,
        domain,
        ...authChecks,
        blacklisted: blacklistStatus.blacklisted,
        blacklist_details: blacklistStatus.details,
        last_checked: new Date().toISOString(),
      }, {
        onConflict: 'workspace_id,domain',
      })
      .select()
      .single();
      
    // Calculate overall score
    let overallScore = 50; // Base score
    if (authChecks.spf_valid) overallScore += 15;
    if (authChecks.dkim_valid) overallScore += 15;
    if (authChecks.dmarc_valid) overallScore += 10;
    if (!blacklistStatus.blacklisted) overallScore += 10;
    
    // Update score
    await supabase
      .from('domain_reputation')
      .update({ overall_score: overallScore })
      .eq('id', reputation.id);
    
    return {
      domain,
      ...authChecks,
      overall_score: overallScore,
      blacklisted: blacklistStatus.blacklisted,
      delivery_rate: reputation.delivery_rate || 0,
      bounce_rate: reputation.bounce_rate || 0,
      complaint_rate: reputation.complaint_rate || 0,
    };
  }
  
  /**
   * Run inbox placement test
   */
  async runInboxPlacementTest(
    testName: string,
    fromEmail: string,
    subject: string,
    htmlContent: string,
    seedEmails: string[]
  ): Promise<InboxPlacementTest> {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);
    
    // Create test record
    const { data: test } = await supabase
      .from('inbox_placement_tests')
      .insert({
        workspace_id: this.workspaceId,
        test_name: testName,
        from_email: fromEmail,
        subject,
        seed_emails: seedEmails,
        status: 'pending',
      })
      .select()
      .single();
      
    // In a real implementation, this would:
    // 1. Send emails to seed addresses
    // 2. Wait for delivery
    // 3. Check placement via IMAP or provider APIs
    // 4. Update results
    
    // For now, simulate results
    setTimeout(async () => {
      const results = {
        gmail_results: { inbox: 8, promotions: 1, spam: 1 },
        outlook_results: { inbox: 7, junk: 2, other: 1 },
        yahoo_results: { inbox: 9, spam: 1 },
        inbox_rate: 75,
        spam_rate: 12.5,
        missing_rate: 12.5,
      };
      
      await supabase
        .from('inbox_placement_tests')
        .update({
          ...results,
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', test.id);
    }, 5000);
    
    return test;
  }
  
  /**
   * Get deliverability recommendations
   */
  async getRecommendations(): Promise<any[]> {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);
    
    const { data: recommendations } = await supabase
      .from('deliverability_recommendations')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .eq('status', 'pending')
      .order('priority', { ascending: true })
      .order('impact_score', { ascending: false });
      
    return recommendations || [];
  }
  
  /**
   * Analyze sending patterns
   */
  async analyzeSendingPatterns(date?: Date): Promise<any> {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);
    
    const analysisDate = date || new Date();
    const dateStr = analysisDate.toISOString().split('T')[0];
    
    // Get email events for the day
    const { data: events } = await supabase
      .from('email_events')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .gte('created_at', `${dateStr}T00:00:00Z`)
      .lt('created_at', `${dateStr}T23:59:59Z`);
      
    if (!events || events.length === 0) {
      return null;
    }
    
    // Analyze patterns
    const sendsByHour: Record<number, number> = {};
    const uniqueRecipients = new Set<string>();
    const uniqueDomains = new Set<string>();
    
    let opens = 0, clicks = 0, replies = 0, bounces = 0, complaints = 0;
    
    events.forEach(event => {
      const hour = new Date(event.created_at).getHours();
      sendsByHour[hour] = (sendsByHour[hour] || 0) + 1;
      
      if (event.recipient_email) {
        uniqueRecipients.add(event.recipient_email);
        const domain = event.recipient_email.split('@')[1];
        if (domain) uniqueDomains.add(domain);
      }
      
      switch (event.event_type) {
        case 'open': opens++; break;
        case 'click': clicks++; break;
        case 'reply': replies++; break;
        case 'bounce':
        case 'hard_bounce':
        case 'soft_bounce': bounces++; break;
        case 'complaint': complaints++; break;
      }
    });
    
    const totalSent = events.filter(e => e.event_type === 'sent').length;
    
    // Save analysis
    const { data: pattern } = await supabase
      .from('sending_patterns')
      .upsert({
        workspace_id: this.workspaceId,
        analysis_date: dateStr,
        total_emails_sent: totalSent,
        unique_recipients: uniqueRecipients.size,
        unique_domains: uniqueDomains.size,
        sends_by_hour: sendsByHour,
        avg_open_rate: totalSent > 0 ? (opens / totalSent * 100) : 0,
        avg_click_rate: totalSent > 0 ? (clicks / totalSent * 100) : 0,
        avg_reply_rate: totalSent > 0 ? (replies / totalSent * 100) : 0,
        avg_bounce_rate: totalSent > 0 ? (bounces / totalSent * 100) : 0,
        avg_complaint_rate: totalSent > 0 ? (complaints / totalSent * 100) : 0,
      }, {
        onConflict: 'workspace_id,analysis_date',
      })
      .select()
      .single();
      
    return pattern;
  }
  
  /**
   * Helper: Analyze content
   */
  private analyzeContent(subject: string, bodyHtml: string, bodyText: string) {
    const text = bodyText || bodyHtml.replace(/<[^>]*>/g, '');
    
    // Word count
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
    
    // Link count
    const linkCount = (bodyHtml.match(/href=/gi) || []).length;
    
    // Image count
    const imageCount = (bodyHtml.match(/<img/gi) || []).length;
    
    // Caps percentage
    const capsCount = (text.match(/[A-Z]/g) || []).length;
    const totalChars = text.replace(/\s/g, '').length;
    const capsPercentage = totalChars > 0 ? (capsCount / totalChars * 100) : 0;
    
    // Exclamation count
    const exclamationCount = (text.match(/!/g) || []).length;
    
    // Spam words
    const spamWords = [
      'free', 'guarantee', 'limited time', 'act now', 'urgent',
      'winner', 'congratulations', 'click here', 'buy now',
      'order now', 'limited offer', '100% free', 'risk-free',
    ];
    const spamWordCount = spamWords.filter(word => 
      text.toLowerCase().includes(word)
    ).length;
    
    return {
      word_count: wordCount,
      link_count: linkCount,
      image_count: imageCount,
      caps_percentage: Math.round(capsPercentage * 100) / 100,
      exclamation_count: exclamationCount,
      spam_word_count: spamWordCount,
    };
  }
  
  /**
   * Helper: Get risk level
   */
  private getRiskLevel(spamScore: number): 'low' | 'medium' | 'high' | 'critical' {
    if (spamScore < 3) return 'low';
    if (spamScore < 5) return 'medium';
    if (spamScore < 7) return 'high';
    return 'critical';
  }
  
  /**
   * Helper: Predict inbox placement
   */
  private predictInboxPlacement(spamScore: number, contentAnalysis: any) {
    // Simplified prediction logic
    const placement = {
      gmail: 'inbox' as const,
      outlook: 'inbox' as const,
      yahoo: 'inbox' as const,
    };
    
    // Gmail is strict about promotional content
    if (spamScore > 5 || contentAnalysis.link_count > 5) {
      placement.gmail = 'spam';
    } else if (spamScore > 3 || contentAnalysis.spam_word_count > 2) {
      placement.gmail = 'promotions';
    }
    
    // Outlook focuses on authentication
    if (spamScore > 6) {
      placement.outlook = 'junk';
    } else if (spamScore > 4) {
      placement.outlook = 'other';
    }
    
    // Yahoo is less strict
    if (spamScore > 7) {
      placement.yahoo = 'spam';
    }
    
    return placement;
  }
  
  /**
   * Helper: Check email authentication
   */
  private async checkEmailAuthentication(domain: string) {
    const results = {
      spf_record: '',
      spf_valid: false,
      dkim_record: '',
      dkim_valid: false,
      dmarc_record: '',
      dmarc_valid: false,
    };
    
    try {
      // Check SPF
      const spfRecords = await dns.resolveTxt(domain);
      const spfRecord = spfRecords.flat().find(r => r.startsWith('v=spf1'));
      if (spfRecord) {
        results.spf_record = spfRecord;
        results.spf_valid = spfRecord.includes('include:') || spfRecord.includes('a:');
      }
      
      // Check DMARC
      const dmarcRecords = await dns.resolveTxt(`_dmarc.${domain}`);
      const dmarcRecord = dmarcRecords.flat().find(r => r.startsWith('v=DMARC1'));
      if (dmarcRecord) {
        results.dmarc_record = dmarcRecord;
        results.dmarc_valid = true;
      }
      
      // DKIM would require knowing the selector, which varies
      // In production, you'd check common selectors or get from config
      results.dkim_valid = false; // Placeholder
      
    } catch (error) {
      console.error('DNS lookup error:', error);
    }
    
    return results;
  }
  
  /**
   * Helper: Check blacklists
   */
  private async checkBlacklists(domain: string): Promise<{
    blacklisted: boolean;
    details: any[];
  }> {
    // In production, check against major blacklists:
    // - Spamhaus
    // - SURBL
    // - Barracuda
    // - SpamCop
    // etc.
    
    // For now, return clean status
    return {
      blacklisted: false,
      details: [],
    };
  }
}