import { createClient } from '@/lib/supabase/client'
import { demoEmailTemplates } from './email-templates'
import { sampleCampaigns } from './sample-campaigns'

export async function seedDemoContent(workspaceId: string) {
  const supabase = createClient()

  try {
    // 1. Create demo email templates
    const templatePromises = demoEmailTemplates.map(async (template) => {
      const { error } = await supabase
        .from('email_templates')
        .insert({
          workspace_id: workspaceId,
          name: template.name,
          category: template.category,
          subject: template.subject,
          body: template.body,
          variables: template.variables,
          tone: template.tone,
          intent: template.intent,
          is_demo: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      
      if (error) {
        console.error('Error creating template:', template.name, error)
      }
    })

    await Promise.all(templatePromises)

    // 2. Create sample leads for campaigns
    const sampleLeads = [
      {
        workspace_id: workspaceId,
        email: 'john.smith@techcorp.com',
        first_name: 'John',
        last_name: 'Smith',
        company: 'TechCorp Inc.',
        title: 'VP of Sales',
        industry: 'Technology',
        company_size: '500-1000',
        linkedin_url: 'https://linkedin.com/in/johnsmith',
        enrichment_data: {
          technologies: ['Salesforce', 'HubSpot', 'Slack'],
          revenue: '$50M-100M',
          location: 'San Francisco, CA'
        }
      },
      {
        workspace_id: workspaceId,
        email: 'sarah.johnson@innovate.io',
        first_name: 'Sarah',
        last_name: 'Johnson',
        company: 'Innovate.io',
        title: 'Head of Marketing',
        industry: 'SaaS',
        company_size: '100-500',
        linkedin_url: 'https://linkedin.com/in/sarahjohnson',
        enrichment_data: {
          technologies: ['Marketo', 'Google Analytics', 'Segment'],
          revenue: '$10M-50M',
          location: 'Austin, TX'
        }
      },
      {
        workspace_id: workspaceId,
        email: 'michael.chen@dataworks.ai',
        first_name: 'Michael',
        last_name: 'Chen',
        company: 'DataWorks AI',
        title: 'CTO',
        industry: 'Artificial Intelligence',
        company_size: '50-100',
        linkedin_url: 'https://linkedin.com/in/michaelchen',
        enrichment_data: {
          technologies: ['AWS', 'Python', 'TensorFlow', 'Kubernetes'],
          revenue: '$5M-10M',
          location: 'Seattle, WA',
          funding: 'Series A - $15M'
        }
      },
      {
        workspace_id: workspaceId,
        email: 'emily.rodriguez@ecomleaders.com',
        first_name: 'Emily',
        last_name: 'Rodriguez',
        company: 'EcomLeaders',
        title: 'CEO',
        industry: 'E-commerce',
        company_size: '10-50',
        linkedin_url: 'https://linkedin.com/in/emilyrodriguez',
        enrichment_data: {
          technologies: ['Shopify', 'Klaviyo', 'Facebook Ads'],
          revenue: '$1M-5M',
          location: 'Miami, FL'
        }
      },
      {
        workspace_id: workspaceId,
        email: 'david.kim@cloudstack.dev',
        first_name: 'David',
        last_name: 'Kim',
        company: 'CloudStack Dev',
        title: 'VP of Engineering',
        industry: 'Cloud Infrastructure',
        company_size: '100-500',
        linkedin_url: 'https://linkedin.com/in/davidkim',
        enrichment_data: {
          technologies: ['AWS', 'Azure', 'Docker', 'Jenkins'],
          revenue: '$20M-50M',
          location: 'Denver, CO'
        }
      }
    ]

    const { error: leadsError } = await supabase
      .from('leads')
      .insert(sampleLeads)

    if (leadsError) {
      console.error('Error creating sample leads:', leadsError)
    }

    // 3. Create sample campaigns (without executing them)
    const campaignPromises = sampleCampaigns.map(async (campaign) => {
      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .insert({
          workspace_id: workspaceId,
          name: campaign.name,
          description: campaign.description,
          status: campaign.status === 'active' ? 'draft' : campaign.status, // Don't activate demo campaigns
          settings: campaign.settings,
          tags: campaign.tags,
          ai_settings: campaign.aiSettings,
          is_demo: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (campaignError || !campaignData) {
        console.error('Error creating campaign:', campaign.name, campaignError)
        return
      }

      // Create campaign sequence steps
      const sequencePromises = campaign.sequence.map(async (step, index) => {
        const templateName = step.template
        const { data: template } = await supabase
          .from('email_templates')
          .select('id')
          .eq('workspace_id', workspaceId)
          .eq('name', templateName)
          .single()

        await supabase
          .from('campaign_sequences')
          .insert({
            campaign_id: campaignData.id,
            step_number: step.step,
            delay_days: step.delay,
            template_id: template?.id,
            subject: step.subject,
            body: step.body,
            condition: step.condition,
            wait_for_reply: step.waitForReply,
            include_calendar_link: step.includeCalendarLink,
            include_attachments: step.attachments,
            created_at: new Date().toISOString()
          })
      })

      await Promise.all(sequencePromises)

      // Add sample metrics for visual appeal (if campaign has metrics)
      if (campaign.metrics && campaign.status !== 'draft') {
        await supabase
          .from('campaign_metrics')
          .insert({
            campaign_id: campaignData.id,
            emails_sent: campaign.metrics.sent,
            emails_delivered: campaign.metrics.delivered,
            emails_opened: campaign.metrics.opened,
            emails_clicked: campaign.metrics.clicked,
            emails_replied: campaign.metrics.replied,
            meetings_booked: campaign.metrics.booked || campaign.metrics.meetings_booked || 0,
            unsubscribes: campaign.metrics.unsubscribed || 0,
            updated_at: new Date().toISOString()
          })
      }
    })

    await Promise.all(campaignPromises)

    // 4. Create a welcome message in the inbox
    const { error: messageError } = await supabase
      .from('email_messages')
      .insert({
        workspace_id: workspaceId,
        from_email: 'welcome@coldcopy.cc',
        from_name: 'ColdCopy Team',
        to_email: 'demo@example.com',
        subject: 'Welcome to ColdCopy! 🎉',
        body_text: `Welcome to ColdCopy!

We've set up some demo content to help you explore the platform:

✅ 8 professional email templates for different use cases
✅ 6 sample campaigns showing real-world scenarios
✅ 5 sample leads with enriched data

Here's how to get started:

1. Check out the Templates section to see our AI-powered email templates
2. Visit Campaigns to see examples of multi-step sequences
3. Go to Leads to see enriched contact data
4. Try creating your own campaign using our AI email writer

Need help? Just reply to this message or check out our docs at docs.coldcopy.cc

Happy cold emailing!
The ColdCopy Team`,
        body_html: `<p>Welcome to ColdCopy!</p>
<p>We've set up some demo content to help you explore the platform:</p>
<ul>
<li>✅ 8 professional email templates for different use cases</li>
<li>✅ 6 sample campaigns showing real-world scenarios</li>
<li>✅ 5 sample leads with enriched data</li>
</ul>
<p>Here's how to get started:</p>
<ol>
<li>Check out the Templates section to see our AI-powered email templates</li>
<li>Visit Campaigns to see examples of multi-step sequences</li>
<li>Go to Leads to see enriched contact data</li>
<li>Try creating your own campaign using our AI email writer</li>
</ol>
<p>Need help? Just reply to this message or check out our docs at docs.coldcopy.cc</p>
<p>Happy cold emailing!<br>The ColdCopy Team</p>`,
        is_read: false,
        is_demo: true,
        created_at: new Date().toISOString()
      })

    if (messageError) {
      console.error('Error creating welcome message:', messageError)
    }

    console.log('✅ Demo content seeded successfully for workspace:', workspaceId)
    return { success: true }

  } catch (error) {
    console.error('Error seeding demo content:', error)
    return { success: false, error }
  }
}

// Function to be called when a new workspace is created
export async function onWorkspaceCreated(workspaceId: string, skipDemoContent?: boolean) {
  if (skipDemoContent) {
    return
  }

  // Seed demo content in the background
  setTimeout(async () => {
    await seedDemoContent(workspaceId)
  }, 1000) // Small delay to ensure workspace is fully created
}