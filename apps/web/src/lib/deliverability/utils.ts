import { createClient } from '@supabase/supabase-js'

export interface DeliverabilityMetrics {
  totalSent: number
  totalDelivered: number
  totalBounced: number
  totalComplaints: number
  deliveryRate: number
  bounceRate: number
  complaintRate: number
  reputation: 'excellent' | 'good' | 'fair' | 'poor'
  overallScore: number
}

export interface DomainStats {
  domain: string
  sent: number
  delivered: number
  bounced: number
  complained: number
  deliveryRate: number
  bounceRate: number
  complaintRate: number
  reputation: 'excellent' | 'good' | 'fair' | 'poor'
}

export class DeliverabilityUtils {
  static calculateOverallScore(metrics: Partial<DeliverabilityMetrics>): number {
    const deliveryWeight = 0.4
    const bounceWeight = 0.3
    const complaintWeight = 0.3

    const deliveryScore = Math.max(0, (metrics.deliveryRate || 0))
    const bounceScore = Math.max(0, 100 - (metrics.bounceRate || 0) * 10)
    const complaintScore = Math.max(0, 100 - (metrics.complaintRate || 0) * 20)

    return Math.round(
      deliveryScore * deliveryWeight +
      bounceScore * bounceWeight +
      complaintScore * complaintWeight
    )
  }

  static determineReputation(bounceRate: number, complaintRate: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (complaintRate > 0.5 || bounceRate > 10) return 'poor'
    if (complaintRate > 0.3 || bounceRate > 7) return 'fair'
    if (complaintRate > 0.1 || bounceRate > 5) return 'good'
    return 'excellent'
  }

  static getReputationColor(reputation: string): string {
    switch (reputation) {
      case 'excellent': return 'text-green-600'
      case 'good': return 'text-blue-600'
      case 'fair': return 'text-yellow-600'
      case 'poor': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  static getScoreColor(score: number): string {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  static formatRate(rate: number): string {
    return `${rate.toFixed(1)}%`
  }

  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  static extractDomain(email: string): string | null {
    if (!this.isValidEmail(email)) return null
    return email.split('@')[1].toLowerCase()
  }

  static async checkSuppressionList(emails: string[], workspaceId: string): Promise<{
    suppressed: string[]
    allowed: string[]
  }> {
    try {
      // This would typically use your Supabase client
      // For now, returning a mock response
      const suppressed = emails.filter(email => 
        email.includes('bounced') || 
        email.includes('complaint') || 
        email.includes('unsubscribe')
      )
      
      const allowed = emails.filter(email => !suppressed.includes(email))
      
      return { suppressed, allowed }
    } catch (error) {
      console.error('Error checking suppression list:', error)
      return { suppressed: [], allowed: emails }
    }
  }

  static generateDeliverabilityReport(metrics: DeliverabilityMetrics, domainStats: DomainStats[]): {
    summary: string
    recommendations: string[]
    criticalIssues: string[]
    improvements: string[]
  } {
    const recommendations: string[] = []
    const criticalIssues: string[] = []
    const improvements: string[] = []

    // Analyze overall metrics
    if (metrics.bounceRate > 5) {
      criticalIssues.push(`High bounce rate (${metrics.bounceRate.toFixed(1)}%) - Clean your email list`)
      recommendations.push('Implement double opt-in to improve list quality')
      recommendations.push('Use email validation services before sending')
    }

    if (metrics.complaintRate > 0.1) {
      criticalIssues.push(`High complaint rate (${metrics.complaintRate.toFixed(1)}%) - Review content and targeting`)
      recommendations.push('Add clear unsubscribe links to all emails')
      recommendations.push('Segment your audience for more relevant content')
    }

    if (metrics.deliveryRate < 95) {
      criticalIssues.push(`Low delivery rate (${metrics.deliveryRate.toFixed(1)}%) - Check authentication`)
      recommendations.push('Verify SPF, DKIM, and DMARC records')
      recommendations.push('Monitor sender reputation with ISPs')
    }

    // Analyze domain-specific issues
    const problematicDomains = domainStats.filter(d => d.bounceRate > 5 || d.complaintRate > 0.1)
    if (problematicDomains.length > 0) {
      improvements.push(`Focus on improving delivery to: ${problematicDomains.map(d => d.domain).join(', ')}`)
    }

    // Positive improvements
    if (metrics.deliveryRate >= 98) {
      improvements.push('Excellent delivery rate - maintain current practices')
    }

    if (metrics.complaintRate < 0.05) {
      improvements.push('Low complaint rate indicates good content relevance')
    }

    // Generate summary
    const summary = `Your email deliverability score is ${metrics.overallScore}% with a ${metrics.reputation} reputation. ` +
      `You've sent ${metrics.totalSent.toLocaleString()} emails with ${metrics.deliveryRate.toFixed(1)}% delivery rate.`

    return {
      summary,
      recommendations: recommendations.slice(0, 5), // Top 5 recommendations
      criticalIssues,
      improvements
    }
  }

  static getIndustryBenchmarks(): {
    deliveryRate: { excellent: number; good: number; average: number }
    bounceRate: { excellent: number; good: number; average: number }
    complaintRate: { excellent: number; good: number; average: number }
  } {
    return {
      deliveryRate: { excellent: 98, good: 95, average: 85 },
      bounceRate: { excellent: 2, good: 5, average: 10 },
      complaintRate: { excellent: 0.05, good: 0.1, average: 0.5 }
    }
  }

  static compareToIndustry(metrics: DeliverabilityMetrics): {
    deliveryRating: 'excellent' | 'good' | 'average' | 'poor'
    bounceRating: 'excellent' | 'good' | 'average' | 'poor'
    complaintRating: 'excellent' | 'good' | 'average' | 'poor'
    overallRating: 'excellent' | 'good' | 'average' | 'poor'
  } {
    const benchmarks = this.getIndustryBenchmarks()

    const deliveryRating = 
      metrics.deliveryRate >= benchmarks.deliveryRate.excellent ? 'excellent' :
      metrics.deliveryRate >= benchmarks.deliveryRate.good ? 'good' :
      metrics.deliveryRate >= benchmarks.deliveryRate.average ? 'average' : 'poor'

    const bounceRating = 
      metrics.bounceRate <= benchmarks.bounceRate.excellent ? 'excellent' :
      metrics.bounceRate <= benchmarks.bounceRate.good ? 'good' :
      metrics.bounceRate <= benchmarks.bounceRate.average ? 'average' : 'poor'

    const complaintRating = 
      metrics.complaintRate <= benchmarks.complaintRate.excellent ? 'excellent' :
      metrics.complaintRate <= benchmarks.complaintRate.good ? 'good' :
      metrics.complaintRate <= benchmarks.complaintRate.average ? 'average' : 'poor'

    // Overall rating based on worst performer
    const ratings = [deliveryRating, bounceRating, complaintRating]
    const overallRating = 
      ratings.includes('poor') ? 'poor' :
      ratings.includes('average') ? 'average' :
      ratings.includes('good') ? 'good' : 'excellent'

    return {
      deliveryRating,
      bounceRating,
      complaintRating,
      overallRating
    }
  }

  static generateActionPlan(metrics: DeliverabilityMetrics, comparison: ReturnType<typeof DeliverabilityUtils.compareToIndustry>): {
    priority: 'high' | 'medium' | 'low'
    action: string
    description: string
    expectedImpact: string
  }[] {
    const actions: {
      priority: 'high' | 'medium' | 'low'
      action: string
      description: string
      expectedImpact: string
    }[] = []

    // High priority actions
    if (comparison.bounceRating === 'poor') {
      actions.push({
        priority: 'high',
        action: 'Clean Email List',
        description: 'Remove invalid and non-existent email addresses',
        expectedImpact: 'Reduce bounce rate by 3-5%'
      })
    }

    if (comparison.complaintRating === 'poor') {
      actions.push({
        priority: 'high',
        action: 'Review Email Content',
        description: 'Analyze content for spam triggers and improve relevance',
        expectedImpact: 'Reduce complaint rate by 0.2-0.3%'
      })
    }

    if (comparison.deliveryRating === 'poor') {
      actions.push({
        priority: 'high',
        action: 'Fix Authentication',
        description: 'Implement proper SPF, DKIM, and DMARC records',
        expectedImpact: 'Improve delivery rate by 5-10%'
      })
    }

    // Medium priority actions
    if (comparison.bounceRating === 'average') {
      actions.push({
        priority: 'medium',
        action: 'Implement Email Validation',
        description: 'Add real-time email validation at signup',
        expectedImpact: 'Prevent 80% of invalid emails'
      })
    }

    if (comparison.deliveryRating === 'average') {
      actions.push({
        priority: 'medium',
        action: 'Monitor Sender Reputation',
        description: 'Set up monitoring for blacklists and reputation',
        expectedImpact: 'Early detection of issues'
      })
    }

    // Low priority actions (for already good performance)
    if (comparison.overallRating === 'excellent') {
      actions.push({
        priority: 'low',
        action: 'Optimize Send Times',
        description: 'Test different sending times for better engagement',
        expectedImpact: 'Marginal improvements in engagement'
      })
    }

    if (comparison.overallRating !== 'poor') {
      actions.push({
        priority: 'low',
        action: 'A/B Test Subject Lines',
        description: 'Test different subject line strategies',
        expectedImpact: 'Improve open rates by 2-5%'
      })
    }

    return actions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })
  }

  static formatTimeTrend(currentValue: number, previousValue: number): {
    direction: 'up' | 'down' | 'stable'
    percentage: number
    formatted: string
  } {
    if (previousValue === 0) {
      return { direction: 'stable', percentage: 0, formatted: 'No change' }
    }

    const change = ((currentValue - previousValue) / previousValue) * 100
    const direction = change > 0.1 ? 'up' : change < -0.1 ? 'down' : 'stable'
    
    return {
      direction,
      percentage: Math.abs(change),
      formatted: `${direction === 'up' ? '↗' : direction === 'down' ? '↘' : '→'} ${Math.abs(change).toFixed(1)}%`
    }
  }

  static exportToCSV(data: any[], filename: string): void {
    if (!data.length) return

    const headers = Object.keys(data[0])
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => 
          JSON.stringify(row[header] || '')
        ).join(',')
      )
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    link.setAttribute('href', url)
    link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}