export const demoEmailTemplates = [
  {
    name: "SaaS Sales - Decision Maker",
    category: "B2B SaaS",
    subject: "Quick question about {{company}}'s {{pain_point}}",
    body: `Hi {{first_name}},

I noticed {{company}} is {{observed_challenge}} and wanted to reach out.

We recently helped {{similar_company}} {{achievement}}, and I think we could do something similar for you.

The main difference with our approach is {{unique_value_prop}}.

Worth a quick 15-minute call to explore if this could work for {{company}}?

{{sender_name}}`,
    variables: ["first_name", "company", "pain_point", "observed_challenge", "similar_company", "achievement", "unique_value_prop", "sender_name"],
    tone: "professional",
    intent: "meeting_request"
  },
  
  {
    name: "E-commerce Partnership",
    category: "E-commerce",
    subject: "Partnership opportunity for {{company}}",
    body: `Hi {{first_name}},

I've been following {{company}}'s growth in the {{industry}} space - congrats on {{recent_achievement}}!

I'm reaching out because we work with brands like {{similar_brands}} to {{value_proposition}}.

Our partners typically see:
• {{metric_1}}
• {{metric_2}}
• {{metric_3}}

I'd love to show you how we could help {{company}} achieve similar results.

Are you free for a brief call {{day_options}}?

Best,
{{sender_name}}`,
    variables: ["first_name", "company", "industry", "recent_achievement", "similar_brands", "value_proposition", "metric_1", "metric_2", "metric_3", "day_options", "sender_name"],
    tone: "friendly",
    intent: "partnership"
  },

  {
    name: "Recruiting - Tech Talent",
    category: "Recruiting",
    subject: "{{first_name}} - Exciting opportunity at {{company}}",
    body: `Hi {{first_name}},

I came across your profile and was impressed by your experience with {{specific_skill}}.

I'm reaching out because we have an exciting {{position_title}} role at {{company}} that seems like a perfect match for your background.

What makes this opportunity special:
• {{benefit_1}}
• {{benefit_2}}
• {{benefit_3}}

The team is looking for someone who can {{key_responsibility}}, which aligns perfectly with your work at {{current_company}}.

Would you be open to a confidential conversation about this opportunity?

{{sender_name}}
{{company}} Talent Team`,
    variables: ["first_name", "specific_skill", "position_title", "company", "benefit_1", "benefit_2", "benefit_3", "key_responsibility", "current_company", "sender_name"],
    tone: "enthusiastic",
    intent: "recruiting"
  },

  {
    name: "Agency - New Business",
    category: "Marketing Agency",
    subject: "{{company}}'s {{marketing_channel}} caught my attention",
    body: `Hi {{first_name}},

I've been analyzing {{company}}'s {{marketing_channel}} strategy and noticed {{observation}}.

We specialize in helping {{industry}} companies like yours {{value_proposition}}. 

For example, we recently helped {{case_study_client}} achieve:
{{case_study_result}}

I have a few ideas on how we could improve {{company}}'s {{improvement_area}} that I'd love to share.

Do you have 20 minutes {{day_options}} for a quick call?

{{sender_name}}
{{agency_name}}`,
    variables: ["first_name", "company", "marketing_channel", "observation", "industry", "value_proposition", "case_study_client", "case_study_result", "improvement_area", "day_options", "sender_name", "agency_name"],
    tone: "consultative",
    intent: "sales"
  },

  {
    name: "Follow-up - No Response",
    category: "Follow-up",
    subject: "Re: {{original_subject}}",
    body: `Hi {{first_name}},

I wanted to follow up on my previous email about {{topic}}.

I understand you're busy, so I'll keep this brief. 

{{follow_up_value_prop}}

If this isn't a priority right now, no worries. But if you're interested, I'm happy to share more details.

Would a quick call {{day_options}} work?

{{sender_name}}

P.S. - {{ps_message}}`,
    variables: ["first_name", "original_subject", "topic", "follow_up_value_prop", "day_options", "sender_name", "ps_message"],
    tone: "friendly",
    intent: "follow_up"
  },

  {
    name: "Event Invitation - VIP",
    category: "Events",
    subject: "{{first_name}}, you're invited - {{event_name}}",
    body: `Hi {{first_name}},

As a leader in {{industry}}, I wanted to personally invite you to {{event_name}} on {{event_date}}.

We're bringing together {{attendee_description}} to discuss {{event_topic}}.

Your VIP invitation includes:
• {{vip_benefit_1}}
• {{vip_benefit_2}}
• {{vip_benefit_3}}

{{speaker_name}} from {{speaker_company}} will be keynoting, and I think you'd find their insights on {{keynote_topic}} particularly valuable.

Space is limited to {{attendee_limit}} executives. Can I reserve your spot?

{{sender_name}}
{{event_role}}`,
    variables: ["first_name", "industry", "event_name", "event_date", "attendee_description", "event_topic", "vip_benefit_1", "vip_benefit_2", "vip_benefit_3", "speaker_name", "speaker_company", "keynote_topic", "attendee_limit", "sender_name", "event_role"],
    tone: "professional",
    intent: "event_invitation"
  },

  {
    name: "Customer Win-back",
    category: "Customer Success",
    subject: "{{first_name}}, we've made the changes you asked for",
    body: `Hi {{first_name}},

It's been {{time_period}} since you were using {{product_name}}, and I wanted to personally reach out.

Based on your feedback and that of other customers, we've made significant improvements:
• {{improvement_1}}
• {{improvement_2}}
• {{improvement_3}}

I'd love to offer you {{special_offer}} to see the new {{product_name}} in action.

Plus, if you come back now, you'll get:
{{incentive}}

Are you free for a quick demo {{day_options}}? I'd love to show you what's new.

{{sender_name}}
{{company}} Customer Success`,
    variables: ["first_name", "time_period", "product_name", "improvement_1", "improvement_2", "improvement_3", "special_offer", "incentive", "day_options", "sender_name", "company"],
    tone: "warm",
    intent: "win_back"
  },

  {
    name: "Investor Outreach",
    category: "Fundraising", 
    subject: "{{company}} - {{round_type}} opportunity in {{industry}}",
    body: `Hi {{first_name}},

I'm reaching out because {{trigger_event}} and I know you've invested in similar companies like {{portfolio_company}}.

{{company}} is {{company_description}}. We've achieved:
• {{traction_1}}
• {{traction_2}}
• {{traction_3}}

We're raising {{funding_amount}} to {{use_of_funds}}.

{{notable_investor}} recently joined our round, and we have {{remaining_amount}} remaining.

Would you be interested in a 30-minute call to learn more?

{{sender_name}}
Founder & CEO, {{company}}`,
    variables: ["first_name", "company", "round_type", "industry", "trigger_event", "portfolio_company", "company_description", "traction_1", "traction_2", "traction_3", "funding_amount", "use_of_funds", "notable_investor", "remaining_amount", "sender_name"],
    tone: "confident",
    intent: "fundraising"
  }
];