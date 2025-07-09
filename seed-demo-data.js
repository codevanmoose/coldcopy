const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function seedDemoData() {
  console.log('🌱 Seeding demo data...\n');
  
  try {
    // Get the workspace ID for the admin user
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id')
      .single();
    
    if (!workspace) {
      console.error('❌ No workspace found');
      return;
    }
    
    const workspaceId = workspace.id;
    console.log(`📦 Using workspace: ${workspaceId}\n`);
    
    // 1. Create some demo leads
    console.log('👥 Creating demo leads...');
    const leads = [
      {
        workspace_id: workspaceId,
        email: 'john.smith@techcorp.com',
        first_name: 'John',
        last_name: 'Smith',
        company: 'TechCorp',
        title: 'VP of Sales',
        status: 'qualified',
        tags: ['enterprise', 'hot-lead'],
        metadata: { industry: 'Technology', employees: '500-1000' }
      },
      {
        workspace_id: workspaceId,
        email: 'sarah.johnson@innovate.io',
        first_name: 'Sarah',
        last_name: 'Johnson',
        company: 'Innovate.io',
        title: 'Marketing Director',
        status: 'contacted',
        tags: ['startup', 'saas'],
        metadata: { industry: 'SaaS', employees: '50-100' }
      },
      {
        workspace_id: workspaceId,
        email: 'mike.wilson@globalfinance.com',
        first_name: 'Mike',
        last_name: 'Wilson',
        company: 'Global Finance',
        title: 'CTO',
        status: 'replied',
        tags: ['fintech', 'enterprise'],
        metadata: { industry: 'Finance', employees: '1000+' }
      },
      {
        workspace_id: workspaceId,
        email: 'emma.davis@retailplus.com',
        first_name: 'Emma',
        last_name: 'Davis',
        company: 'RetailPlus',
        title: 'Head of Operations',
        status: 'new',
        tags: ['retail', 'mid-market'],
        metadata: { industry: 'Retail', employees: '100-500' }
      },
      {
        workspace_id: workspaceId,
        email: 'alex.chen@datainsights.ai',
        first_name: 'Alex',
        last_name: 'Chen',
        company: 'DataInsights AI',
        title: 'CEO',
        status: 'qualified',
        tags: ['ai', 'startup', 'hot-lead'],
        metadata: { industry: 'AI/ML', employees: '10-50' }
      }
    ];
    
    const { error: leadsError } = await supabase
      .from('leads')
      .upsert(leads, { onConflict: 'workspace_id,email' });
    
    if (leadsError) {
      console.log('⚠️  Some leads may already exist');
    } else {
      console.log('✅ Created 5 demo leads');
    }
    
    // 2. Create demo email templates
    console.log('\n📧 Creating email templates...');
    const templates = [
      {
        workspace_id: workspaceId,
        name: 'Initial Outreach - SaaS',
        subject: 'Quick question about {{company}}\'s sales process',
        body: 'Hi {{first_name}},\n\nI noticed {{company}} has been growing rapidly. Many companies at your stage struggle with scaling their outbound sales.\n\nWe help SaaS companies like yours automate personalized outreach while maintaining high reply rates.\n\nWorth a quick chat to see if we can help {{company}} too?\n\nBest,\n{{sender_name}}',
        category: 'cold_outreach',
        tags: ['saas', 'initial'],
        metadata: { ai_optimized: true, avg_reply_rate: 0.23 }
      },
      {
        workspace_id: workspaceId,
        name: 'Follow-up #1',
        subject: 'Re: Quick question about {{company}}\'s sales process',
        body: 'Hi {{first_name}},\n\nJust wanted to bump this up in case it got buried.\n\nWe recently helped a similar company increase their reply rates by 3x. Would love to share how.\n\nAre you free for a 15-min call this week?\n\nBest,\n{{sender_name}}',
        category: 'follow_up',
        tags: ['follow-up', 'sequence'],
        metadata: { sequence_position: 2, days_delay: 3 }
      },
      {
        workspace_id: workspaceId,
        name: 'Enterprise Decision Maker',
        subject: 'Improving {{company}}\'s sales efficiency',
        body: 'Dear {{first_name}},\n\nAs {{title}} at {{company}}, you\'re likely focused on improving sales efficiency.\n\nOur AI-powered platform helps enterprise teams:\n• Increase reply rates by 40%\n• Save 10+ hours per week on outreach\n• Generate 3x more qualified meetings\n\nWould you be interested in seeing how this could work for {{company}}?\n\nBest regards,\n{{sender_name}}',
        category: 'cold_outreach',
        tags: ['enterprise', 'executive'],
        metadata: { ai_optimized: true, tone: 'professional' }
      }
    ];
    
    const { error: templatesError } = await supabase
      .from('templates')
      .upsert(templates, { onConflict: 'workspace_id,name' });
    
    if (templatesError) {
      console.log('⚠️  Some templates may already exist');
    } else {
      console.log('✅ Created 3 email templates');
    }
    
    // 3. Create demo campaigns
    console.log('\n🚀 Creating demo campaigns...');
    const campaigns = [
      {
        workspace_id: workspaceId,
        name: 'Q1 Enterprise Outreach',
        status: 'active',
        settings: {
          daily_limit: 50,
          timezone: 'America/New_York',
          sending_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          sending_hours: { start: 9, end: 17 }
        },
        metadata: {
          target_industry: 'Enterprise',
          expected_reply_rate: 0.15
        }
      },
      {
        workspace_id: workspaceId,
        name: 'SaaS Startup Campaign',
        status: 'active',
        settings: {
          daily_limit: 100,
          timezone: 'America/Los_Angeles',
          sending_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          sending_hours: { start: 8, end: 18 }
        },
        metadata: {
          target_industry: 'SaaS',
          expected_reply_rate: 0.25
        }
      },
      {
        workspace_id: workspaceId,
        name: 'Holiday Promotion',
        status: 'paused',
        settings: {
          daily_limit: 30,
          timezone: 'America/Chicago'
        },
        metadata: {
          campaign_type: 'promotional'
        }
      }
    ];
    
    const { data: createdCampaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .upsert(campaigns, { onConflict: 'workspace_id,name' })
      .select();
    
    if (campaignsError) {
      console.log('⚠️  Some campaigns may already exist');
    } else {
      console.log('✅ Created 3 demo campaigns');
    }
    
    // 4. Create campaign emails (email sending history)
    if (createdCampaigns && createdCampaigns.length > 0) {
      console.log('\n📨 Creating email activity...');
      
      const { data: leadsData } = await supabase
        .from('leads')
        .select('id')
        .eq('workspace_id', workspaceId)
        .limit(5);
      
      const emailActivities = [];
      const now = new Date();
      
      // Create some email activities for the active campaigns
      for (const campaign of createdCampaigns.filter(c => c.status === 'active')) {
        for (let i = 0; i < 3 && i < leadsData.length; i++) {
          const sentAt = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000); // Random time in last 7 days
          
          emailActivities.push({
            workspace_id: workspaceId,
            campaign_id: campaign.id,
            lead_id: leadsData[i].id,
            template_id: null,
            status: ['sent', 'delivered', 'opened', 'clicked'][Math.floor(Math.random() * 4)],
            sent_at: sentAt.toISOString(),
            delivered_at: Math.random() > 0.1 ? new Date(sentAt.getTime() + 60000).toISOString() : null,
            opened_at: Math.random() > 0.3 ? new Date(sentAt.getTime() + 3600000).toISOString() : null,
            clicked_at: Math.random() > 0.7 ? new Date(sentAt.getTime() + 7200000).toISOString() : null,
            metadata: {
              subject: 'Demo email subject',
              preview_text: 'This is a demo email...'
            }
          });
        }
      }
      
      const { error: emailsError } = await supabase
        .from('campaign_emails')
        .insert(emailActivities);
      
      if (emailsError) {
        console.log('⚠️  Error creating email activities:', emailsError.message);
      } else {
        console.log(`✅ Created ${emailActivities.length} email activities`);
      }
    }
    
    // 5. Create some inbox messages (replies)
    console.log('\n💬 Creating inbox messages...');
    const inboxMessages = [
      {
        workspace_id: workspaceId,
        thread_id: 'thread-' + Date.now() + '-1',
        from_email: 'john.smith@techcorp.com',
        from_name: 'John Smith',
        subject: 'Re: Quick question about TechCorp\'s sales process',
        body: 'Hi there,\n\nThis sounds interesting. We are indeed looking to improve our outbound sales process.\n\nCan you send me more information about your platform and pricing?\n\nThanks,\nJohn',
        is_read: false,
        is_replied: false,
        received_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        metadata: { sentiment: 'positive', intent: 'interested' }
      },
      {
        workspace_id: workspaceId,
        thread_id: 'thread-' + Date.now() + '-2',
        from_email: 'mike.wilson@globalfinance.com',
        from_name: 'Mike Wilson',
        subject: 'Re: Improving Global Finance\'s sales efficiency',
        body: 'Thanks for reaching out.\n\nWe\'re happy with our current solution. Please remove me from your list.\n\nMike',
        is_read: true,
        is_replied: true,
        received_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        metadata: { sentiment: 'negative', intent: 'not_interested' }
      },
      {
        workspace_id: workspaceId,
        thread_id: 'thread-' + Date.now() + '-3',
        from_email: 'alex.chen@datainsights.ai',
        from_name: 'Alex Chen',
        subject: 'Re: Quick question about DataInsights AI\'s sales process',
        body: 'Hi,\n\nI\'d be interested in learning more. Are you available for a call next Tuesday at 2 PM PST?\n\nBest,\nAlex',
        is_read: true,
        is_replied: false,
        received_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
        metadata: { sentiment: 'positive', intent: 'meeting_request' }
      }
    ];
    
    const { error: inboxError } = await supabase
      .from('email_messages')
      .upsert(inboxMessages, { onConflict: 'workspace_id,thread_id' });
    
    if (inboxError) {
      console.log('⚠️  Some inbox messages may already exist');
    } else {
      console.log('✅ Created 3 inbox messages');
    }
    
    // 6. Create analytics data
    console.log('\n📊 Creating analytics data...');
    
    // Create daily stats for the last 30 days
    const dailyStats = [];
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      dailyStats.push({
        workspace_id: workspaceId,
        date: date.toISOString().split('T')[0],
        emails_sent: Math.floor(Math.random() * 100) + 20,
        emails_delivered: Math.floor(Math.random() * 95) + 18,
        emails_opened: Math.floor(Math.random() * 40) + 10,
        emails_clicked: Math.floor(Math.random() * 15) + 2,
        emails_replied: Math.floor(Math.random() * 8) + 1,
        leads_created: Math.floor(Math.random() * 20) + 5,
        campaigns_created: Math.random() > 0.8 ? 1 : 0
      });
    }
    
    const { error: statsError } = await supabase
      .from('analytics_daily')
      .upsert(dailyStats, { onConflict: 'workspace_id,date' });
    
    if (statsError) {
      console.log('⚠️  Analytics data may already exist');
    } else {
      console.log('✅ Created 30 days of analytics data');
    }
    
    console.log('\n🎉 Demo data seeding complete!');
    console.log('The dashboard should now show:');
    console.log('- Lead statistics and growth');
    console.log('- Email sending metrics');
    console.log('- Campaign performance');
    console.log('- Recent activity');
    console.log('- Inbox messages');
    
  } catch (error) {
    console.error('❌ Error seeding data:', error.message);
    process.exit(1);
  }
}

// Run the seeding
seedDemoData().catch(console.error);