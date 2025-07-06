import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { SpamChecker } from '@/lib/deliverability/spam-checker'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { subject, body: emailBody, fromName, fromEmail, replyTo, htmlBody } = body

    // Validate required fields
    if (!subject || !emailBody) {
      return NextResponse.json({ 
        error: 'Subject and email body are required' 
      }, { status: 400 })
    }

    // Analyze spam score
    const result = SpamChecker.analyzeSpamScore({
      subject,
      body: emailBody,
      fromName,
      fromEmail,
      replyTo,
      htmlBody
    })

    // Test deliverability across providers
    const deliverabilityTest = await SpamChecker.testDeliverability({
      subject,
      body: emailBody,
      fromName,
      fromEmail,
      replyTo,
      htmlBody
    })

    // Log the spam check for analytics
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('workspace_id')
      .eq('id', user.id)
      .single()

    if (profile?.workspace_id) {
      // Store spam check result for future reference
      await supabase
        .from('spam_check_logs')
        .insert({
          workspace_id: profile.workspace_id,
          user_id: user.id,
          subject,
          spam_score: result.score,
          spam_level: result.level,
          issues_count: result.issues.length,
          word_count: result.wordCount,
          readability_score: result.readabilityScore,
          checked_at: new Date().toISOString()
        })
        .select()
        .single()
    }

    return NextResponse.json({
      spamAnalysis: result,
      deliverabilityTest,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Spam check error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze email content' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's workspace
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('workspace_id')
      .eq('id', user.id)
      .single()

    if (!profile?.workspace_id) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
    }

    // Get recent spam check history
    const { data: spamChecks, error } = await supabase
      .from('spam_check_logs')
      .select(`
        id,
        subject,
        spam_score,
        spam_level,
        issues_count,
        word_count,
        readability_score,
        checked_at
      `)
      .eq('workspace_id', profile.workspace_id)
      .order('checked_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Error fetching spam check history:', error)
      return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
    }

    // Calculate average scores
    const avgSpamScore = spamChecks.length > 0 
      ? spamChecks.reduce((sum, check) => sum + check.spam_score, 0) / spamChecks.length
      : 0

    const avgReadabilityScore = spamChecks.length > 0
      ? spamChecks.reduce((sum, check) => sum + check.readability_score, 0) / spamChecks.length
      : 0

    return NextResponse.json({
      history: spamChecks,
      analytics: {
        totalChecks: spamChecks.length,
        averageSpamScore: Math.round(avgSpamScore * 10) / 10,
        averageReadabilityScore: Math.round(avgReadabilityScore * 10) / 10,
        lowRiskEmails: spamChecks.filter(c => c.spam_level === 'low').length,
        mediumRiskEmails: spamChecks.filter(c => c.spam_level === 'medium').length,
        highRiskEmails: spamChecks.filter(c => c.spam_level === 'high').length
      }
    })

  } catch (error) {
    console.error('Spam check history error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch spam check history' },
      { status: 500 }
    )
  }
}