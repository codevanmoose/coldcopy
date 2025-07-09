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
    // First, let's check what workspaces exist
    const { data: workspaces, error: wsError } = await supabase
      .from('workspaces')
      .select('*');
    
    console.log('📦 Found workspaces:', workspaces?.length || 0);
    
    let workspaceId;
    
    if (!workspaces || workspaces.length === 0) {
      // Create a default workspace
      console.log('📦 Creating default workspace...');
      const { data: newWorkspace, error: createError } = await supabase
        .from('workspaces')
        .insert({
          name: 'ColdCopy Demo',
          slug: 'coldcopy-demo',
          domain: 'coldcopy.cc',
          settings: {},
          status: 'active'
        })
        .select()
        .single();
      
      if (createError) {
        console.error('❌ Error creating workspace:', createError);
        return;
      }
      
      workspaceId = newWorkspace.id;
      console.log('✅ Created workspace:', workspaceId);
    } else {
      workspaceId = workspaces[0].id;
      console.log(`📦 Using existing workspace: ${workspaceId}`);
    }
    
    // 1. Create some demo leads
    console.log('\n👥 Creating demo leads...');
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
    
    // Check if leads table has the right columns
    const { data: existingLeads } = await supabase
      .from('leads')
      .select('email')
      .eq('workspace_id', workspaceId)
      .limit(1);
    
    for (const lead of leads) {
      const { error } = await supabase
        .from('leads')
        .upsert(lead, { onConflict: 'workspace_id,email' });
      
      if (error && !error.message.includes('duplicate')) {
        console.log(`⚠️  Error with lead ${lead.email}:`, error.message);
      }
    }
    console.log('✅ Created demo leads');
    
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
    
    for (const template of templates) {
      const { error } = await supabase
        .from('templates')
        .upsert(template, { onConflict: 'workspace_id,name' });
      
      if (error && !error.message.includes('duplicate')) {
        console.log(`⚠️  Error with template:`, error.message);
      }
    }
    console.log('✅ Created email templates');
    
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
    
    const createdCampaignIds = [];
    for (const campaign of campaigns) {
      const { data, error } = await supabase
        .from('campaigns')
        .upsert(campaign, { onConflict: 'workspace_id,name' })
        .select()
        .single();
      
      if (error && !error.message.includes('duplicate')) {
        console.log(`⚠️  Error with campaign:`, error.message);
      } else if (data) {
        createdCampaignIds.push(data.id);
      }
    }
    console.log('✅ Created demo campaigns');
    
    // 4. Try to create analytics data (if table exists)
    console.log('\n📊 Creating analytics data...');
    try {
      // First check if analytics_daily table exists
      const { error: checkError } = await supabase
        .from('analytics_daily')
        .select('*')
        .limit(1);
      
      if (!checkError) {
        // Table exists, create data
        const dailyStats = [];
        for (let i = 0; i < 30; i++) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          
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
        
        await supabase
          .from('analytics_daily')
          .upsert(dailyStats, { onConflict: 'workspace_id,date' });
        
        console.log('✅ Created 30 days of analytics data');
      } else {
        console.log('ℹ️  Analytics table not found, skipping');
      }
    } catch (e) {
      console.log('ℹ️  Analytics data creation skipped');
    }
    
    // 5. Create some recent activity (if possible)
    console.log('\n💬 Creating activity data...');
    try {
      const { data: leadsData } = await supabase
        .from('leads')
        .select('id, email, first_name, last_name, company')
        .eq('workspace_id', workspaceId)
        .limit(3);
      
      if (leadsData && leadsData.length > 0 && createdCampaignIds.length > 0) {
        // Try to create campaign_emails if table exists
        const emailActivities = [];
        const now = new Date();
        
        for (let i = 0; i < leadsData.length; i++) {
          const sentAt = new Date(now.getTime() - (i + 1) * 60 * 60 * 1000); // i+1 hours ago
          
          emailActivities.push({
            workspace_id: workspaceId,
            campaign_id: createdCampaignIds[0],
            lead_id: leadsData[i].id,
            template_id: null,
            status: ['sent', 'delivered', 'opened'][i % 3],
            sent_at: sentAt.toISOString(),
            delivered_at: sentAt.toISOString(),
            opened_at: i === 2 ? new Date(sentAt.getTime() + 1800000).toISOString() : null,
            metadata: {
              subject: `Email to ${leadsData[i].first_name}`,
              preview_text: 'Personalized outreach message...'
            }
          });
        }
        
        const { error } = await supabase
          .from('campaign_emails')
          .insert(emailActivities);
        
        if (!error) {
          console.log('✅ Created recent email activities');
        } else {
          console.log('ℹ️  Email activities table not available');
        }
      }
    } catch (e) {
      console.log('ℹ️  Activity data creation skipped');
    }
    
    console.log('\n🎉 Demo data seeding complete!');
    console.log('\nThe dashboard should now show:');
    console.log('- Workspace with demo data');
    console.log('- 5 leads with different statuses');
    console.log('- 3 email templates');
    console.log('- 3 campaigns (2 active, 1 paused)');
    console.log('- Analytics data (if tables exist)');
    console.log('\nYou can now test the dashboard!');
    
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
}

// Run the seeding
seedDemoData().catch(console.error);