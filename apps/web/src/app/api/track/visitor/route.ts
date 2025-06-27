import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SalesIntelligenceService } from '@/lib/sales-intelligence/service';

// Use service role for anonymous tracking
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    const {
      workspace_id,
      visitor_id,
      session_id,
      page_url,
      page_title,
      referrer_url,
      utm_source,
      utm_medium,
      utm_campaign,
      time_on_page,
      scroll_depth,
      clicks,
      user_agent,
      is_new_visitor,
    } = data;
    
    // Validate required fields
    if (!workspace_id || !visitor_id || !session_id || !page_url) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Get IP address from request
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    // Parse user agent for device info
    const deviceInfo = parseUserAgent(user_agent);
    
    // Try to identify company from IP
    const companyInfo = await identifyCompany(ip);
    
    // Check if visitor is already linked to a lead
    const { data: existingVisitor } = await supabase
      .from('website_visitors')
      .select('lead_id')
      .eq('workspace_id', workspace_id)
      .eq('visitor_id', visitor_id)
      .single();
      
    let lead_id = existingVisitor?.lead_id;
    
    // If company identified but no lead linked, try to find lead
    if (!lead_id && companyInfo?.domain) {
      const { data: lead } = await supabase
        .from('leads')
        .select('id')
        .eq('workspace_id', workspace_id)
        .eq('company_domain', companyInfo.domain)
        .single();
        
      lead_id = lead?.id;
    }
    
    // Record the visit
    const salesIntelligence = new SalesIntelligenceService(workspace_id);
    await salesIntelligence.recordWebsiteVisit({
      visitor_id,
      ip_address: ip,
      company_domain: companyInfo?.domain,
      company_name: companyInfo?.name,
      lead_id,
      page_url,
      page_title,
      referrer_url,
      utm_source,
      utm_medium,
      utm_campaign,
      time_on_page,
      scroll_depth,
      clicks,
      user_agent,
      device_type: deviceInfo.device_type,
      browser: deviceInfo.browser,
      country: companyInfo?.country,
      region: companyInfo?.region,
      city: companyInfo?.city,
      session_id,
      is_new_visitor,
    });
    
    // Return success with any identified company info
    return NextResponse.json({
      success: true,
      identified: !!companyInfo,
      company_domain: companyInfo?.domain,
    });
    
  } catch (error) {
    console.error('Visitor tracking error:', error);
    return NextResponse.json(
      { error: 'Failed to track visitor' },
      { status: 500 }
    );
  }
}

// Helper: Parse user agent
function parseUserAgent(userAgent: string): {
  device_type: string;
  browser: string;
} {
  const ua = userAgent.toLowerCase();
  
  // Detect device type
  let device_type = 'desktop';
  if (/mobile|android|iphone|ipad|tablet/.test(ua)) {
    device_type = /tablet|ipad/.test(ua) ? 'tablet' : 'mobile';
  }
  
  // Detect browser
  let browser = 'other';
  if (ua.includes('chrome') && !ua.includes('edge')) {
    browser = 'chrome';
  } else if (ua.includes('safari') && !ua.includes('chrome')) {
    browser = 'safari';
  } else if (ua.includes('firefox')) {
    browser = 'firefox';
  } else if (ua.includes('edge')) {
    browser = 'edge';
  }
  
  return { device_type, browser };
}

// Helper: Identify company from IP
async function identifyCompany(ip: string): Promise<{
  domain: string;
  name: string;
  country?: string;
  region?: string;
  city?: string;
} | null> {
  // Skip identification for local/private IPs
  if (ip === 'unknown' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip === '127.0.0.1') {
    return null;
  }
  
  try {
    // This would integrate with services like:
    // - Clearbit Reveal
    // - Leadfeeder
    // - Albacross
    // - Custom IP intelligence database
    
    // For now, return mock data in development
    if (process.env.NODE_ENV === 'development') {
      return {
        domain: 'example.com',
        name: 'Example Company',
        country: 'US',
        region: 'California',
        city: 'San Francisco',
      };
    }
    
    // TODO: Implement actual IP identification service
    return null;
  } catch (error) {
    console.error('Company identification error:', error);
    return null;
  }
}

// OPTIONS method for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}