const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function seedDemoData() {
  console.log('🌱 Seeding demo data...\n');
  
  try {
    // Use the existing workspace ID from setup-admin output
    const workspaceId = '7cc2a5a5-2980-4b87-8d00-a26489b9970e';
    console.log(`📦 Using workspace: ${workspaceId}\n`);
    
    // 1. Create leads
    console.log('👥 Creating demo leads...');
    const leads = [
      {
        workspace_id: workspaceId,
        email: 'john.smith@techcorp.com',
        first_name: 'John',
        last_name: 'Smith',
        company: 'TechCorp',
        title: 'VP of Sales',
        status: 'qualified'
      },
      {
        workspace_id: workspaceId,
        email: 'sarah.johnson@innovate.io',
        first_name: 'Sarah', 
        last_name: 'Johnson',
        company: 'Innovate.io',
        title: 'Marketing Director',
        status: 'contacted'
      },
      {
        workspace_id: workspaceId,
        email: 'mike.wilson@globalfinance.com',
        first_name: 'Mike',
        last_name: 'Wilson', 
        company: 'Global Finance',
        title: 'CTO',
        status: 'replied'
      },
      {
        workspace_id: workspaceId,
        email: 'emma.davis@retailplus.com',
        first_name: 'Emma',
        last_name: 'Davis',
        company: 'RetailPlus', 
        title: 'Head of Operations',
        status: 'new'
      },
      {
        workspace_id: workspaceId,
        email: 'alex.chen@datainsights.ai',
        first_name: 'Alex',
        last_name: 'Chen',
        company: 'DataInsights AI',
        title: 'CEO',
        status: 'qualified'
      }
    ];
    
    const { data: createdLeads, error: leadsError } = await supabase
      .from('leads')
      .insert(leads)
      .select();
      
    if (leadsError) {
      console.log('⚠️  Leads error:', leadsError.message);
    } else {
      console.log(`✅ Created ${createdLeads?.length || 0} leads`);
    }
    
    // 2. Create campaigns
    console.log('\n🚀 Creating demo campaigns...');
    const campaigns = [
      {
        workspace_id: workspaceId,
        name: 'Q1 Enterprise Outreach',
        status: 'active'
      },
      {
        workspace_id: workspaceId,
        name: 'SaaS Startup Campaign', 
        status: 'active'
      },
      {
        workspace_id: workspaceId,
        name: 'Holiday Promotion',
        status: 'paused'
      }
    ];
    
    const { data: createdCampaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .insert(campaigns)
      .select();
      
    if (campaignsError) {
      console.log('⚠️  Campaigns error:', campaignsError.message);
    } else {
      console.log(`✅ Created ${createdCampaigns?.length || 0} campaigns`);
    }
    
    // 3. Create templates
    console.log('\n📧 Creating email templates...');
    const templates = [
      {
        workspace_id: workspaceId,
        name: 'Initial Outreach - SaaS',
        subject: 'Quick question about {{company}}\'s sales process',
        body: 'Hi {{first_name}},\n\nI noticed {{company}} has been growing rapidly...',
        category: 'cold_outreach'
      },
      {
        workspace_id: workspaceId,
        name: 'Follow-up #1',
        subject: 'Re: Quick question',
        body: 'Hi {{first_name}},\n\nJust wanted to bump this up...',
        category: 'follow_up'
      },
      {
        workspace_id: workspaceId,
        name: 'Enterprise Decision Maker',
        subject: 'Improving {{company}}\'s sales efficiency',
        body: 'Dear {{first_name}},\n\nAs {{title}} at {{company}}...',
        category: 'cold_outreach'
      }
    ];
    
    const { data: createdTemplates, error: templatesError } = await supabase
      .from('templates')
      .insert(templates)
      .select();
      
    if (templatesError) {
      console.log('⚠️  Templates error:', templatesError.message);
    } else {
      console.log(`✅ Created ${createdTemplates?.length || 0} templates`);
    }
    
    // 4. Create campaign performance data
    if (createdCampaigns && createdCampaigns.length > 0) {
      console.log('\n📊 Creating campaign performance data...');
      
      // Create some email send records
      const emailRecords = [];
      const now = new Date();
      
      for (const campaign of createdCampaigns.slice(0, 2)) { // Only active campaigns
        for (let i = 0; i < 50; i++) {
          const sentDate = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);
          const isOpened = Math.random() > 0.5;
          const isClicked = isOpened && Math.random() > 0.7;
          const isReplied = isClicked && Math.random() > 0.8;
          
          emailRecords.push({
            workspace_id: workspaceId,
            campaign_id: campaign.id,
            lead_id: createdLeads ? createdLeads[i % createdLeads.length].id : null,
            status: isReplied ? 'replied' : isClicked ? 'clicked' : isOpened ? 'opened' : 'sent',
            sent_at: sentDate.toISOString()
          });
        }
      }
      
      const { error: emailError } = await supabase
        .from('campaign_emails')
        .insert(emailRecords);
        
      if (emailError) {
        console.log('⚠️  Email records error:', emailError.message);
      } else {
        console.log(`✅ Created ${emailRecords.length} email activity records`);
      }
    }
    
    console.log('\n🎉 Demo data seeding complete!');
    console.log('\nThe dashboard now has:');
    console.log('- 5 demo leads');
    console.log('- 3 campaigns (2 active)');
    console.log('- 3 email templates');
    console.log('- Campaign performance data');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

seedDemoData().catch(console.error);