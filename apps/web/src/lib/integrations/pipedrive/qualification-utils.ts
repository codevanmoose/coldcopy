import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { SentimentResult } from '@/lib/ai/sentiment-analysis';
import { LeadQualificationData } from './reply-handler-types';

export interface QualificationScoreFactors {
  sentiment: {
    weight: number;
    scoring: {
      positive: number;
      neutral: number;
      negative: number;
    };
  };
  intent: {
    weight: number;
    scoring: {
      interested: number;
      meeting_request: number;
      question: number;
      not_interested: number;
      complaint: number;
      unsubscribe: number;
      unclear: number;
    };
  };
  confidence: {
    weight: number;
    minThreshold: number;
  };
  leadData: {
    weight: number;
    factors: {
      hasCompany: number;
      hasTitle: number;
      hasPhone: number;
      isBusinessEmail: number;
      hasLinkedIn: number;
    };
  };
  engagement: {
    weight: number;
    factors: {
      emailOpens: number;
      emailClicks: number;
      previousReplies: number;
      websiteVisits: number;
      downloadedContent: number;
    };
  };
  companyData: {
    weight: number;
    factors: {
      companySize: {
        startup: number;
        small: number;
        medium: number;
        large: number;
        enterprise: number;
      };
      funding: {
        unfunded: number;
        seed: number;
        seriesA: number;
        seriesB: number;
        seriesC: number;
        ipo: number;
      };
      industry: Record<string, number>;
    };
  };
  urgency: {
    weight: number;
    scoring: {
      low: number;
      medium: number;
      high: number;
    };
  };
}

export interface QualificationResult {
  totalScore: number;
  maxPossibleScore: number;
  normalizedScore: number; // 0-100
  tier: 'cold' | 'warm' | 'hot' | 'qualified';
  factors: {
    sentiment: number;
    intent: number;
    confidence: number;
    leadData: number;
    engagement: number;
    companyData: number;
    urgency: number;
  };
  reasoning: string[];
  recommendations: string[];
  nextActions: string[];
}

export interface LeadEnrichmentData {
  basic: {
    firstName?: string;
    lastName?: string;
    fullName?: string;
    title?: string;
    company?: string;
    industry?: string;
    location?: string;
    linkedInUrl?: string;
    twitterUrl?: string;
    phoneNumber?: string;
  };
  company: {
    name?: string;
    domain?: string;
    size?: string;
    employees?: number;
    revenue?: number;
    industry?: string;
    foundedYear?: number;
    headquarters?: string;
    description?: string;
    technologies?: string[];
    socialProfiles?: {
      linkedin?: string;
      twitter?: string;
      facebook?: string;
      instagram?: string;
    };
    funding?: {
      stage?: string;
      totalFunding?: number;
      lastRound?: {
        amount: number;
        date: string;
        investors: string[];
      };
    };
  };
  enrichmentSource: string;
  enrichmentDate: Date;
  confidence: number;
  verified: boolean;
}

export const DEFAULT_QUALIFICATION_FACTORS: QualificationScoreFactors = {
  sentiment: {
    weight: 0.25,
    scoring: {
      positive: 100,
      neutral: 60,
      negative: 20,
    },
  },
  intent: {
    weight: 0.30,
    scoring: {
      interested: 100,
      meeting_request: 120,
      question: 80,
      not_interested: 10,
      complaint: 5,
      unsubscribe: 0,
      unclear: 40,
    },
  },
  confidence: {
    weight: 0.15,
    minThreshold: 0.5,
  },
  leadData: {
    weight: 0.10,
    factors: {
      hasCompany: 20,
      hasTitle: 15,
      hasPhone: 10,
      isBusinessEmail: 25,
      hasLinkedIn: 15,
    },
  },
  engagement: {
    weight: 0.10,
    factors: {
      emailOpens: 5,
      emailClicks: 10,
      previousReplies: 15,
      websiteVisits: 8,
      downloadedContent: 12,
    },
  },
  companyData: {
    weight: 0.08,
    factors: {
      companySize: {
        startup: 60,
        small: 70,
        medium: 85,
        large: 95,
        enterprise: 100,
      },
      funding: {
        unfunded: 50,
        seed: 60,
        seriesA: 75,
        seriesB: 85,
        seriesC: 95,
        ipo: 100,
      },
      industry: {
        'technology': 90,
        'software': 95,
        'saas': 100,
        'finance': 85,
        'healthcare': 80,
        'consulting': 75,
        'manufacturing': 70,
        'retail': 65,
        'education': 70,
        'government': 60,
      },
    },
  },
  urgency: {
    weight: 0.02,
    scoring: {
      low: 50,
      medium: 75,
      high: 100,
    },
  },
};

export class LeadQualificationService {
  private workspaceId: string;
  private qualificationFactors: QualificationScoreFactors;

  constructor(workspaceId: string, customFactors?: Partial<QualificationScoreFactors>) {
    this.workspaceId = workspaceId;
    this.qualificationFactors = {
      ...DEFAULT_QUALIFICATION_FACTORS,
      ...customFactors,
    };
  }

  /**
   * Calculate comprehensive qualification score for a lead based on reply sentiment and data
   */
  async calculateQualificationScore(
    sentiment: SentimentResult,
    leadData: LeadQualificationData
  ): Promise<QualificationResult> {
    const factors = {
      sentiment: this.calculateSentimentScore(sentiment),
      intent: this.calculateIntentScore(sentiment),
      confidence: this.calculateConfidenceScore(sentiment),
      leadData: this.calculateLeadDataScore(leadData),
      engagement: this.calculateEngagementScore(leadData),
      companyData: this.calculateCompanyDataScore(leadData),
      urgency: this.calculateUrgencyScore(sentiment),
    };

    // Calculate weighted total score
    const totalScore = 
      factors.sentiment * this.qualificationFactors.sentiment.weight +
      factors.intent * this.qualificationFactors.intent.weight +
      factors.confidence * this.qualificationFactors.confidence.weight +
      factors.leadData * this.qualificationFactors.leadData.weight +
      factors.engagement * this.qualificationFactors.engagement.weight +
      factors.companyData * this.qualificationFactors.companyData.weight +
      factors.urgency * this.qualificationFactors.urgency.weight;

    // Calculate max possible score for normalization
    const maxPossibleScore = 
      120 * this.qualificationFactors.intent.weight + // meeting_request has highest score
      100 * (this.qualificationFactors.sentiment.weight + 
             this.qualificationFactors.confidence.weight +
             this.qualificationFactors.leadData.weight +
             this.qualificationFactors.engagement.weight +
             this.qualificationFactors.companyData.weight +
             this.qualificationFactors.urgency.weight);

    const normalizedScore = Math.min(100, (totalScore / maxPossibleScore) * 100);
    const tier = this.determineTier(normalizedScore);

    const reasoning = this.generateReasoning(sentiment, leadData, factors);
    const recommendations = this.generateRecommendations(sentiment, leadData, normalizedScore);
    const nextActions = this.generateNextActions(sentiment, normalizedScore, tier);

    return {
      totalScore,
      maxPossibleScore,
      normalizedScore,
      tier,
      factors,
      reasoning,
      recommendations,
      nextActions,
    };
  }

  /**
   * Calculate sentiment score component
   */
  private calculateSentimentScore(sentiment: SentimentResult): number {
    return this.qualificationFactors.sentiment.scoring[sentiment.sentiment];
  }

  /**
   * Calculate intent score component
   */
  private calculateIntentScore(sentiment: SentimentResult): number {
    return this.qualificationFactors.intent.scoring[sentiment.intent];
  }

  /**
   * Calculate confidence score component
   */
  private calculateConfidenceScore(sentiment: SentimentResult): number {
    if (sentiment.confidence < this.qualificationFactors.confidence.minThreshold) {
      return 0;
    }
    return sentiment.confidence * 100;
  }

  /**
   * Calculate lead data quality score
   */
  private calculateLeadDataScore(leadData: LeadQualificationData): number {
    const factors = this.qualificationFactors.leadData.factors;
    let score = 0;

    if (leadData.basicInfo.hasCompany) score += factors.hasCompany;
    if (leadData.basicInfo.hasTitle) score += factors.hasTitle;
    if (leadData.basicInfo.hasPhone) score += factors.hasPhone;
    if (leadData.basicInfo.isValidBusinessEmail) score += factors.isBusinessEmail;
    // hasLinkedIn would need to be added to LeadQualificationData interface

    return Math.min(100, score);
  }

  /**
   * Calculate engagement score based on history
   */
  private calculateEngagementScore(leadData: LeadQualificationData): number {
    const factors = this.qualificationFactors.engagement.factors;
    const engagement = leadData.engagementHistory;
    let score = 0;

    // Calculate engagement multipliers
    const openRate = engagement.totalEmails > 0 ? engagement.opened / engagement.totalEmails : 0;
    const clickRate = engagement.opened > 0 ? engagement.clicked / engagement.opened : 0;

    score += openRate * factors.emailOpens * 10; // Scale up
    score += clickRate * factors.emailClicks * 10;
    score += Math.min(engagement.replied, 3) * factors.previousReplies; // Cap at 3 replies
    score += Math.min(engagement.engagementScore / 10, 10) * 5; // Use existing engagement score

    return Math.min(100, score);
  }

  /**
   * Calculate company data score
   */
  private calculateCompanyDataScore(leadData: LeadQualificationData): number {
    if (!leadData.companyData) return 50; // Default mid-score if no company data

    const factors = this.qualificationFactors.companyData.factors;
    let score = 0;
    let components = 0;

    // Company size scoring
    if (leadData.companyData.size) {
      score += factors.companySize[leadData.companyData.size] || 50;
      components++;
    }

    // Funding scoring
    if (leadData.companyData.funding) {
      score += factors.funding[leadData.companyData.funding.stage] || 50;
      components++;
    }

    // Industry scoring
    if (leadData.companyData.industry) {
      const industryScore = factors.industry[leadData.companyData.industry.toLowerCase()] || 60;
      score += industryScore;
      components++;
    }

    return components > 0 ? score / components : 50;
  }

  /**
   * Calculate urgency score
   */
  private calculateUrgencyScore(sentiment: SentimentResult): number {
    return this.qualificationFactors.urgency.scoring[sentiment.urgency];
  }

  /**
   * Determine qualification tier
   */
  private determineTier(normalizedScore: number): 'cold' | 'warm' | 'hot' | 'qualified' {
    if (normalizedScore >= 80) return 'qualified';
    if (normalizedScore >= 65) return 'hot';
    if (normalizedScore >= 45) return 'warm';
    return 'cold';
  }

  /**
   * Generate reasoning for the score
   */
  private generateReasoning(
    sentiment: SentimentResult,
    leadData: LeadQualificationData,
    factors: any
  ): string[] {
    const reasoning: string[] = [];

    // Sentiment reasoning
    if (sentiment.sentiment === 'positive') {
      reasoning.push('Positive sentiment indicates genuine interest');
    } else if (sentiment.sentiment === 'negative') {
      reasoning.push('Negative sentiment may indicate objections or concerns');
    }

    // Intent reasoning
    if (sentiment.intent === 'meeting_request') {
      reasoning.push('Explicit meeting request shows high buying intent');
    } else if (sentiment.intent === 'interested') {
      reasoning.push('Expressed interest in the product/service');
    } else if (sentiment.intent === 'question') {
      reasoning.push('Questions indicate engagement and consideration');
    }

    // Confidence reasoning
    if (sentiment.confidence < 0.7) {
      reasoning.push('Lower confidence in sentiment analysis may affect accuracy');
    }

    // Lead data reasoning
    if (leadData.basicInfo.isValidBusinessEmail) {
      reasoning.push('Business email address suggests legitimate prospect');
    }
    if (leadData.basicInfo.hasCompany && leadData.basicInfo.hasTitle) {
      reasoning.push('Complete professional profile indicates decision-making capability');
    }

    // Company data reasoning
    if (leadData.companyData?.size === 'enterprise' || leadData.companyData?.size === 'large') {
      reasoning.push('Large company size suggests higher potential deal value');
    }
    if (leadData.companyData?.funding?.stage === 'ipo' || leadData.companyData?.funding?.stage === 'seriesC') {
      reasoning.push('Well-funded company indicates budget availability');
    }

    return reasoning;
  }

  /**
   * Generate recommendations for handling the lead
   */
  private generateRecommendations(
    sentiment: SentimentResult,
    leadData: LeadQualificationData,
    score: number
  ): string[] {
    const recommendations: string[] = [];

    if (score >= 80) {
      recommendations.push('High-priority lead - assign to senior sales rep');
      recommendations.push('Schedule immediate follow-up call or meeting');
    } else if (score >= 65) {
      recommendations.push('Promising lead - personal follow-up recommended');
      recommendations.push('Provide relevant case studies or product demo');
    } else if (score >= 45) {
      recommendations.push('Nurture with targeted content marketing');
      recommendations.push('Add to automated follow-up sequence');
    } else {
      recommendations.push('Low-priority lead - add to general nurture campaign');
    }

    // Intent-specific recommendations
    if (sentiment.intent === 'meeting_request') {
      recommendations.push('Respond immediately to schedule meeting');
    } else if (sentiment.intent === 'question') {
      recommendations.push('Provide detailed answer to their specific question');
    } else if (sentiment.intent === 'not_interested') {
      recommendations.push('Respect their decision and add to long-term nurture');
    }

    // Urgency-specific recommendations
    if (sentiment.urgency === 'high') {
      recommendations.push('Same-day response required');
    } else if (sentiment.urgency === 'medium') {
      recommendations.push('Respond within 24 hours');
    }

    return recommendations;
  }

  /**
   * Generate next actions for the lead
   */
  private generateNextActions(
    sentiment: SentimentResult,
    score: number,
    tier: string
  ): string[] {
    const actions: string[] = [];

    // Tier-based actions
    switch (tier) {
      case 'qualified':
        actions.push('Create deal in CRM');
        actions.push('Assign to account executive');
        actions.push('Schedule discovery call');
        break;
      case 'hot':
        actions.push('Create person in CRM');
        actions.push('Send personalized follow-up');
        actions.push('Add to sales sequence');
        break;
      case 'warm':
        actions.push('Add to nurture campaign');
        actions.push('Send relevant content');
        break;
      case 'cold':
        actions.push('Add to long-term nurture');
        break;
    }

    // Intent-specific actions
    if (sentiment.intent === 'meeting_request') {
      actions.unshift('Send calendar booking link');
    } else if (sentiment.intent === 'question') {
      actions.unshift('Prepare detailed response');
    } else if (sentiment.intent === 'unsubscribe') {
      actions.push('Process unsubscribe request');
      actions.push('Add to suppression list');
    }

    return actions;
  }

  /**
   * Enrich lead data from external sources
   */
  async enrichLeadData(
    email: string,
    existingData?: Partial<LeadEnrichmentData>
  ): Promise<LeadEnrichmentData | null> {
    // This would integrate with enrichment services like Clearbit, ZoomInfo, etc.
    // For now, return mock data structure
    
    const domain = email.split('@')[1];
    
    // Mock enrichment - replace with actual service integration
    const mockEnrichment: LeadEnrichmentData = {
      basic: {
        email,
        company: domain.replace('.com', '').replace('.', ' '),
        ...existingData?.basic,
      },
      company: {
        domain,
        name: domain.replace('.com', '').replace('.', ' '),
        ...existingData?.company,
      },
      enrichmentSource: 'mock',
      enrichmentDate: new Date(),
      confidence: 0.5,
      verified: false,
    };

    return mockEnrichment;
  }

  /**
   * Update lead qualification factors configuration
   */
  updateQualificationFactors(newFactors: Partial<QualificationScoreFactors>): void {
    this.qualificationFactors = {
      ...this.qualificationFactors,
      ...newFactors,
    };
  }

  /**
   * Get lead qualification history
   */
  async getLeadQualificationHistory(leadId: string): Promise<any[]> {
    const supabase = createServerClient(cookies());

    const { data } = await supabase
      .from('email_replies')
      .select(`
        id,
        received_at,
        sentiment,
        intent,
        qualification_score,
        sentiment_confidence,
        urgency,
        key_phrases
      `)
      .eq('lead_id', leadId)
      .eq('workspace_id', this.workspaceId)
      .order('received_at', { ascending: false });

    return data || [];
  }

  /**
   * Calculate lead scoring trends
   */
  async calculateLeadScoringTrends(
    leadId: string,
    days: number = 30
  ): Promise<{
    currentScore: number;
    previousScore: number;
    trend: 'improving' | 'declining' | 'stable';
    trendPercentage: number;
    scoringHistory: Array<{
      date: string;
      score: number;
      replies: number;
    }>;
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const supabase = createServerClient(cookies());

    const { data: replies } = await supabase
      .from('email_replies')
      .select('received_at, qualification_score')
      .eq('lead_id', leadId)
      .eq('workspace_id', this.workspaceId)
      .gte('received_at', cutoffDate.toISOString())
      .order('received_at', { ascending: true });

    if (!replies || replies.length === 0) {
      return {
        currentScore: 0,
        previousScore: 0,
        trend: 'stable',
        trendPercentage: 0,
        scoringHistory: [],
      };
    }

    // Group by day and calculate average scores
    const dailyScores = new Map<string, { total: number; count: number }>();
    
    for (const reply of replies) {
      const date = new Date(reply.received_at).toISOString().split('T')[0];
      const existing = dailyScores.get(date) || { total: 0, count: 0 };
      existing.total += reply.qualification_score || 0;
      existing.count += 1;
      dailyScores.set(date, existing);
    }

    const scoringHistory = Array.from(dailyScores.entries()).map(([date, data]) => ({
      date,
      score: data.total / data.count,
      replies: data.count,
    }));

    const currentScore = scoringHistory.length > 0 ? scoringHistory[scoringHistory.length - 1].score : 0;
    const previousScore = scoringHistory.length > 1 ? scoringHistory[0].score : currentScore;
    
    const trendPercentage = previousScore > 0 ? ((currentScore - previousScore) / previousScore) * 100 : 0;
    
    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (Math.abs(trendPercentage) > 5) {
      trend = trendPercentage > 0 ? 'improving' : 'declining';
    }

    return {
      currentScore,
      previousScore,
      trend,
      trendPercentage,
      scoringHistory,
    };
  }

  /**
   * Get qualification benchmarks for workspace
   */
  async getQualificationBenchmarks(): Promise<{
    averageScore: number;
    medianScore: number;
    topQuartile: number;
    bottomQuartile: number;
    conversionRates: {
      coldToWarm: number;
      warmToHot: number;
      hotToQualified: number;
    };
  }> {
    const supabase = createServerClient(cookies());

    const { data: scores } = await supabase
      .from('email_replies')
      .select('qualification_score')
      .eq('workspace_id', this.workspaceId)
      .not('qualification_score', 'is', null)
      .order('qualification_score', { ascending: true });

    if (!scores || scores.length === 0) {
      return {
        averageScore: 0,
        medianScore: 0,
        topQuartile: 0,
        bottomQuartile: 0,
        conversionRates: {
          coldToWarm: 0,
          warmToHot: 0,
          hotToQualified: 0,
        },
      };
    }

    const validScores = scores.map(s => s.qualification_score).filter(s => s !== null);
    const averageScore = validScores.reduce((sum, score) => sum + score, 0) / validScores.length;
    
    const sortedScores = validScores.sort((a, b) => a - b);
    const medianIndex = Math.floor(sortedScores.length / 2);
    const medianScore = sortedScores.length % 2 === 0 
      ? (sortedScores[medianIndex - 1] + sortedScores[medianIndex]) / 2
      : sortedScores[medianIndex];

    const q1Index = Math.floor(sortedScores.length * 0.25);
    const q3Index = Math.floor(sortedScores.length * 0.75);
    
    const bottomQuartile = sortedScores[q1Index];
    const topQuartile = sortedScores[q3Index];

    // Calculate conversion rates (simplified - would need more complex tracking)
    const cold = validScores.filter(s => s < 45).length;
    const warm = validScores.filter(s => s >= 45 && s < 65).length;
    const hot = validScores.filter(s => s >= 65 && s < 80).length;
    const qualified = validScores.filter(s => s >= 80).length;

    return {
      averageScore,
      medianScore,
      topQuartile,
      bottomQuartile,
      conversionRates: {
        coldToWarm: cold > 0 ? (warm / cold) * 100 : 0,
        warmToHot: warm > 0 ? (hot / warm) * 100 : 0,
        hotToQualified: hot > 0 ? (qualified / hot) * 100 : 0,
      },
    };
  }
}