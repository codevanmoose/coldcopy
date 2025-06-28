import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { DNSChecker } from '@/lib/deliverability/dns-checker'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { domain } = body

    // Validate domain
    if (!domain || typeof domain !== 'string') {
      return NextResponse.json({ 
        error: 'Valid domain is required' 
      }, { status: 400 })
    }

    // Clean and validate domain format
    const cleanDomain = domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '')
    
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]*\.([a-z]{2,}|[a-z]{2,}\.[a-z]{2,})$/i.test(cleanDomain)) {
      return NextResponse.json({ 
        error: 'Invalid domain format' 
      }, { status: 400 })
    }

    // Check DNS authentication
    const result = await DNSChecker.checkDomainAuthentication(cleanDomain)

    // Log the DNS check for analytics
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (profile?.workspace_id) {
      // Store DNS check result
      await supabase
        .from('dns_check_logs')
        .insert({
          workspace_id: profile.workspace_id,
          user_id: user.id,
          domain: cleanDomain,
          overall_score: result.overallScore,
          spf_score: result.spf.score,
          dkim_score: result.dkim.score,
          dmarc_score: result.dmarc.score,
          spf_valid: result.spf.isValid,
          dkim_valid: result.dkim.isValid,
          dmarc_valid: result.dmarc.isValid,
          recommendations_count: result.recommendations.length,
          checked_at: new Date().toISOString()
        })
        .select()
        .single()
    }

    // Generate recommended DNS records
    const recommendedRecords = DNSChecker.generateRecommendedRecords(cleanDomain)

    return NextResponse.json({
      domain: cleanDomain,
      authenticationResult: result,
      recommendedRecords,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('DNS check error:', error)
    return NextResponse.json(
      { error: 'Failed to check DNS authentication' },
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
      .eq('user_id', user.id)
      .single()

    if (!profile?.workspace_id) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
    }

    // Get recent DNS check history
    const { data: dnsChecks, error } = await supabase
      .from('dns_check_logs')
      .select(`
        id,
        domain,
        overall_score,
        spf_score,
        dkim_score,
        dmarc_score,
        spf_valid,
        dkim_valid,
        dmarc_valid,
        recommendations_count,
        checked_at
      `)
      .eq('workspace_id', profile.workspace_id)
      .order('checked_at', { ascending: false })
      .limit(20)

    if (error) {
      console.error('Error fetching DNS check history:', error)
      return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
    }

    // Calculate analytics
    const totalChecks = dnsChecks.length
    const avgOverallScore = totalChecks > 0 
      ? dnsChecks.reduce((sum, check) => sum + check.overall_score, 0) / totalChecks
      : 0

    const domainsWithIssues = dnsChecks.filter(check => 
      !check.spf_valid || !check.dkim_valid || !check.dmarc_valid
    ).length

    // Group by domain for latest status
    const domainStatus = dnsChecks.reduce((acc, check) => {
      if (!acc[check.domain] || new Date(check.checked_at) > new Date(acc[check.domain].checked_at)) {
        acc[check.domain] = check
      }
      return acc
    }, {} as Record<string, any>)

    return NextResponse.json({
      history: dnsChecks,
      domainStatus: Object.values(domainStatus),
      analytics: {
        totalChecks,
        uniqueDomains: Object.keys(domainStatus).length,
        averageOverallScore: Math.round(avgOverallScore * 10) / 10,
        domainsWithIssues,
        fullyConfiguredDomains: Object.values(domainStatus).filter((domain: any) => 
          domain.spf_valid && domain.dkim_valid && domain.dmarc_valid
        ).length
      }
    })

  } catch (error) {
    console.error('DNS check history error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch DNS check history' },
      { status: 500 }
    )
  }
}