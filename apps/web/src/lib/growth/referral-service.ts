'use client'

import { createClient } from '@supabase/supabase-js'

export interface ReferralProgram {
  id: string
  workspace_id: string
  name: string
  description?: string
  program_type: 'standard' | 'tiered' | 'custom'
  is_active: boolean
  referrer_reward_type: 'credits' | 'cash' | 'discount' | 'subscription'
  referrer_reward_value: number
  referrer_reward_unit: string
  referee_reward_type: 'credits' | 'cash' | 'discount' | 'subscription'
  referee_reward_value: number
  referee_reward_unit: string
  max_referrals_per_user?: number
  max_reward_per_user?: number
  min_referee_spend: number
  reward_trigger: 'signup' | 'first_payment' | 'spend_threshold'
  total_referrals: number
  total_rewards_paid: number
  starts_at: string
  ends_at?: string
  created_at: string
}

export interface ReferralCode {
  id: string
  workspace_id: string
  user_id: string
  program_id: string
  code: string
  custom_landing_page?: string
  clicks_count: number
  signups_count: number
  conversions_count: number
  total_revenue: number
  is_active: boolean
  created_at: string
  last_used_at?: string
}

export interface Referral {
  id: string
  workspace_id: string
  program_id: string
  referral_code_id: string
  referrer_user_id: string
  referee_user_id?: string
  referee_workspace_id?: string
  referee_email: string
  referee_name?: string
  referral_source: string
  status: 'pending' | 'signed_up' | 'converted' | 'rewarded' | 'cancelled'
  conversion_value: number
  referrer_reward_amount: number
  referee_reward_amount: number
  rewards_paid: boolean
  referred_at: string
  signed_up_at?: string
  converted_at?: string
  rewarded_at?: string
}

export interface ReferralReward {
  id: string
  workspace_id: string
  referral_id: string
  user_id: string
  reward_type: 'referrer' | 'referee'
  reward_value_type: 'credits' | 'cash' | 'discount' | 'subscription'
  reward_amount: number
  reward_unit: string
  payment_method?: string
  payment_reference?: string
  payment_status: 'pending' | 'processing' | 'paid' | 'failed'
  earned_at: string
  paid_at?: string
  expires_at?: string
}

export interface ReferralAnalytics {
  total_referrals: number
  successful_referrals: number
  conversion_rate: number
  total_revenue: number
  total_rewards_paid: number
  roi: number
  top_referrers: Array<{
    user_id: string
    referrals_count: number
    conversions_count: number
    total_revenue: number
    total_rewards: number
  }>
  referral_sources: Array<{
    source: string
    count: number
    conversion_rate: number
  }>
  monthly_trends: Array<{
    month: string
    referrals: number
    conversions: number
    revenue: number
  }>
}

export class ReferralService {
  private supabase: any

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  // Create a new referral program
  async createReferralProgram(params: Partial<ReferralProgram> & { workspace_id: string }): Promise<{
    success: boolean
    program?: ReferralProgram
    error?: string
  }> {
    try {
      const { data, error } = await this.supabase
        .from('referral_programs')
        .insert({
          workspace_id: params.workspace_id,
          name: params.name || 'Referral Program',
          description: params.description,
          program_type: params.program_type || 'standard',
          referrer_reward_type: params.referrer_reward_type || 'credits',
          referrer_reward_value: params.referrer_reward_value || 25,
          referrer_reward_unit: params.referrer_reward_unit || 'dollars',
          referee_reward_type: params.referee_reward_type || 'credits',
          referee_reward_value: params.referee_reward_value || 10,
          referee_reward_unit: params.referee_reward_unit || 'dollars',
          max_referrals_per_user: params.max_referrals_per_user,
          max_reward_per_user: params.max_reward_per_user,
          min_referee_spend: params.min_referee_spend || 0,
          reward_trigger: params.reward_trigger || 'signup',
          starts_at: params.starts_at || new Date().toISOString(),
          ends_at: params.ends_at
        })
        .select()
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, program: data }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  // Generate a referral code for a user
  async generateReferralCode(params: {
    workspace_id: string
    user_id: string
    program_id: string
    prefix?: string
  }): Promise<{
    success: boolean
    code?: string
    referral_code?: ReferralCode
    error?: string
  }> {
    try {
      // Check if user already has an active code for this program
      const { data: existingCode } = await this.supabase
        .from('referral_codes')
        .select('*')
        .eq('user_id', params.user_id)
        .eq('program_id', params.program_id)
        .eq('is_active', true)
        .single()

      if (existingCode) {
        return { 
          success: true, 
          code: existingCode.code,
          referral_code: existingCode
        }
      }

      // Generate new code using database function
      const { data: code, error } = await this.supabase
        .rpc('generate_referral_code', {
          p_workspace_id: params.workspace_id,
          p_user_id: params.user_id,
          p_program_id: params.program_id,
          p_prefix: params.prefix || 'REF'
        })

      if (error) {
        return { success: false, error: error.message }
      }

      // Get the created referral code
      const { data: referralCode } = await this.supabase
        .from('referral_codes')
        .select('*')
        .eq('code', code)
        .single()

      return { 
        success: true, 
        code,
        referral_code: referralCode
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  // Track a referral click
  async trackReferralClick(params: {
    referral_code: string
    utm_source?: string
    utm_medium?: string
    utm_campaign?: string
    ip_address?: string
    user_agent?: string
  }): Promise<{
    success: boolean
    referral_code_id?: string
    error?: string
  }> {
    try {
      // Track click using database function
      const { data: success, error } = await this.supabase
        .rpc('track_referral_click', {
          p_referral_code: params.referral_code,
          p_utm_source: params.utm_source,
          p_utm_medium: params.utm_medium,
          p_utm_campaign: params.utm_campaign
        })

      if (error || !success) {
        return { success: false, error: error?.message || 'Invalid referral code' }
      }

      // Get referral code ID
      const { data: codeData } = await this.supabase
        .from('referral_codes')
        .select('id')
        .eq('code', params.referral_code)
        .single()

      return { 
        success: true,
        referral_code_id: codeData?.id
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  // Process a referral signup
  async processReferralSignup(params: {
    referral_code: string
    referee_email: string
    referee_name?: string
    referee_user_id?: string
    referee_workspace_id?: string
    referral_source?: string
  }): Promise<{
    success: boolean
    referral_id?: string
    error?: string
  }> {
    try {
      const { data: referralId, error } = await this.supabase
        .rpc('process_referral_signup', {
          p_referral_code: params.referral_code,
          p_referee_email: params.referee_email,
          p_referee_name: params.referee_name,
          p_referee_user_id: params.referee_user_id,
          p_referee_workspace_id: params.referee_workspace_id,
          p_referral_source: params.referral_source || 'direct'
        })

      if (error || !referralId) {
        return { success: false, error: error?.message || 'Failed to process referral' }
      }

      return { success: true, referral_id: referralId }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  // Get referral programs for workspace
  async getReferralPrograms(workspaceId: string): Promise<ReferralProgram[]> {
    try {
      const { data, error } = await this.supabase
        .from('referral_programs')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching referral programs:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error fetching referral programs:', error)
      return []
    }
  }

  // Get referral codes for user
  async getUserReferralCodes(userId: string): Promise<ReferralCode[]> {
    try {
      const { data, error } = await this.supabase
        .from('referral_codes')
        .select(`
          *,
          referral_programs (
            name,
            description,
            referrer_reward_value,
            referrer_reward_unit
          )
        `)
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching referral codes:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error fetching referral codes:', error)
      return []
    }
  }

  // Get referrals for user
  async getUserReferrals(userId: string): Promise<Referral[]> {
    try {
      const { data, error } = await this.supabase
        .from('referrals')
        .select(`
          *,
          referral_codes (
            code
          ),
          referral_programs (
            name,
            referrer_reward_value,
            referrer_reward_unit
          )
        `)
        .eq('referrer_user_id', userId)
        .order('referred_at', { ascending: false })

      if (error) {
        console.error('Error fetching referrals:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error fetching referrals:', error)
      return []
    }
  }

  // Mark referral as converted
  async markReferralConverted(params: {
    referral_id: string
    conversion_value: number
    create_rewards?: boolean
  }): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      // Update referral status
      const { error: updateError } = await this.supabase
        .from('referrals')
        .update({
          status: 'converted',
          conversion_value: params.conversion_value,
          converted_at: new Date().toISOString()
        })
        .eq('id', params.referral_id)

      if (updateError) {
        return { success: false, error: updateError.message }
      }

      // Create rewards if requested
      if (params.create_rewards) {
        const rewardResult = await this.createReferralRewards(params.referral_id)
        if (!rewardResult.success) {
          return rewardResult
        }
      }

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  // Create referral rewards
  async createReferralRewards(referralId: string): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      // Get referral and program details
      const { data: referral, error: referralError } = await this.supabase
        .from('referrals')
        .select(`
          *,
          referral_programs (*)
        `)
        .eq('id', referralId)
        .single()

      if (referralError || !referral) {
        return { success: false, error: 'Referral not found' }
      }

      const program = referral.referral_programs

      // Check if rewards already created
      const { data: existingRewards } = await this.supabase
        .from('referral_rewards')
        .select('id')
        .eq('referral_id', referralId)

      if (existingRewards && existingRewards.length > 0) {
        return { success: false, error: 'Rewards already created' }
      }

      // Create referrer reward
      const referrerReward = {
        workspace_id: referral.workspace_id,
        referral_id: referralId,
        user_id: referral.referrer_user_id,
        reward_type: 'referrer',
        reward_value_type: program.referrer_reward_type,
        reward_amount: program.referrer_reward_value,
        reward_unit: program.referrer_reward_unit,
        payment_status: 'pending',
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() // 90 days
      }

      // Create referee reward if referee signed up
      const rewards = [referrerReward]
      if (referral.referee_user_id) {
        rewards.push({
          workspace_id: referral.workspace_id,
          referral_id: referralId,
          user_id: referral.referee_user_id,
          reward_type: 'referee',
          reward_value_type: program.referee_reward_type,
          reward_amount: program.referee_reward_value,
          reward_unit: program.referee_reward_unit,
          payment_status: 'pending',
          expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
        })
      }

      const { error: insertError } = await this.supabase
        .from('referral_rewards')
        .insert(rewards)

      if (insertError) {
        return { success: false, error: insertError.message }
      }

      // Update referral with reward amounts
      await this.supabase
        .from('referrals')
        .update({
          referrer_reward_amount: program.referrer_reward_value,
          referee_reward_amount: referral.referee_user_id ? program.referee_reward_value : 0,
          status: 'rewarded',
          rewarded_at: new Date().toISOString()
        })
        .eq('id', referralId)

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  // Get referral analytics
  async getReferralAnalytics(workspaceId: string, days: number = 30): Promise<ReferralAnalytics> {
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      // Get basic metrics
      const { data: referrals } = await this.supabase
        .from('referrals')
        .select('*')
        .eq('workspace_id', workspaceId)
        .gte('referred_at', startDate.toISOString())

      const totalReferrals = referrals?.length || 0
      const successfulReferrals = referrals?.filter(r => r.status === 'converted' || r.status === 'rewarded').length || 0
      const totalRevenue = referrals?.reduce((sum, r) => sum + (r.conversion_value || 0), 0) || 0

      // Get rewards data
      const { data: rewards } = await this.supabase
        .from('referral_rewards')
        .select('reward_amount')
        .eq('workspace_id', workspaceId)
        .eq('payment_status', 'paid')

      const totalRewardsPaid = rewards?.reduce((sum, r) => sum + r.reward_amount, 0) || 0

      // Calculate metrics
      const conversionRate = totalReferrals > 0 ? (successfulReferrals / totalReferrals) * 100 : 0
      const roi = totalRewardsPaid > 0 ? ((totalRevenue - totalRewardsPaid) / totalRewardsPaid) * 100 : 0

      // Get top referrers
      const { data: topReferrersData } = await this.supabase
        .from('referrals')
        .select(`
          referrer_user_id,
          status,
          conversion_value,
          referrer_reward_amount
        `)
        .eq('workspace_id', workspaceId)
        .gte('referred_at', startDate.toISOString())

      const topReferrersMap = new Map()
      topReferrersData?.forEach(r => {
        const existing = topReferrersMap.get(r.referrer_user_id) || {
          user_id: r.referrer_user_id,
          referrals_count: 0,
          conversions_count: 0,
          total_revenue: 0,
          total_rewards: 0
        }
        
        existing.referrals_count++
        if (r.status === 'converted' || r.status === 'rewarded') {
          existing.conversions_count++
          existing.total_revenue += r.conversion_value || 0
          existing.total_rewards += r.referrer_reward_amount || 0
        }
        
        topReferrersMap.set(r.referrer_user_id, existing)
      })

      const topReferrers = Array.from(topReferrersMap.values())
        .sort((a, b) => b.conversions_count - a.conversions_count)
        .slice(0, 10)

      // Get referral sources
      const sourcesMap = new Map()
      referrals?.forEach(r => {
        const source = r.referral_source || 'direct'
        const existing = sourcesMap.get(source) || { source, count: 0, conversions: 0 }
        existing.count++
        if (r.status === 'converted' || r.status === 'rewarded') {
          existing.conversions++
        }
        sourcesMap.set(source, existing)
      })

      const referralSources = Array.from(sourcesMap.values()).map(s => ({
        source: s.source,
        count: s.count,
        conversion_rate: s.count > 0 ? (s.conversions / s.count) * 100 : 0
      }))

      // Get monthly trends (simplified for last 6 months)
      const monthlyTrends = []
      for (let i = 5; i >= 0; i--) {
        const date = new Date()
        date.setMonth(date.getMonth() - i)
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0)
        
        const monthReferrals = referrals?.filter(r => {
          const referredDate = new Date(r.referred_at)
          return referredDate >= monthStart && referredDate <= monthEnd
        }) || []

        monthlyTrends.push({
          month: date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
          referrals: monthReferrals.length,
          conversions: monthReferrals.filter(r => r.status === 'converted' || r.status === 'rewarded').length,
          revenue: monthReferrals.reduce((sum, r) => sum + (r.conversion_value || 0), 0)
        })
      }

      return {
        total_referrals: totalReferrals,
        successful_referrals: successfulReferrals,
        conversion_rate: conversionRate,
        total_revenue: totalRevenue,
        total_rewards_paid: totalRewardsPaid,
        roi,
        top_referrers: topReferrers,
        referral_sources: referralSources,
        monthly_trends: monthlyTrends
      }
    } catch (error) {
      console.error('Error fetching referral analytics:', error)
      return {
        total_referrals: 0,
        successful_referrals: 0,
        conversion_rate: 0,
        total_revenue: 0,
        total_rewards_paid: 0,
        roi: 0,
        top_referrers: [],
        referral_sources: [],
        monthly_trends: []
      }
    }
  }

  // Get pending rewards for user
  async getUserPendingRewards(userId: string): Promise<ReferralReward[]> {
    try {
      const { data, error } = await this.supabase
        .from('referral_rewards')
        .select(`
          *,
          referrals (
            referee_email,
            referee_name,
            converted_at
          )
        `)
        .eq('user_id', userId)
        .eq('payment_status', 'pending')
        .order('earned_at', { ascending: false })

      if (error) {
        console.error('Error fetching pending rewards:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error fetching pending rewards:', error)
      return []
    }
  }
}

// Export singleton instance
export const referralService = new ReferralService()