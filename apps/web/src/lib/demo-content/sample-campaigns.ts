export const sampleCampaigns = [
  {
    name: "Q1 2025 - Enterprise SaaS Outreach",
    description: "Target Fortune 500 companies for our enterprise solution",
    status: "active",
    settings: {
      dailyLimit: 50,
      timezone: "America/New_York",
      sendWindow: {
        start: "09:00",
        end: "17:00"
      },
      excludeWeekends: true,
      trackOpens: true,
      trackClicks: true
    },
    sequence: [
      {
        step: 1,
        delay: 0,
        template: "SaaS Sales - Decision Maker",
        subject: "Quick question about {{company}}'s sales efficiency",
        waitForReply: true
      },
      {
        step: 2,
        delay: 3,
        template: "Follow-up - No Response",
        subject: "Re: Quick question about {{company}}'s sales efficiency",
        condition: "no_reply",
        waitForReply: true
      },
      {
        step: 3,
        delay: 7,
        template: "Break-up Email",
        subject: "Should I close your file?",
        condition: "no_reply",
        body: `Hi {{first_name}},

I've reached out a couple of times about helping {{company}} improve sales efficiency.

Since I haven't heard back, I'm assuming this isn't a priority right now. I'll close your file and won't reach out again.

If anything changes and you'd like to learn how we helped {{similar_company}} reduce their sales cycle by 32%, just let me know.

Best,
{{sender_name}}`
      }
    ],
    metrics: {
      sent: 1247,
      delivered: 1198,
      opened: 743,
      clicked: 198,
      replied: 67,
      booked: 23,
      unsubscribed: 12
    },
    tags: ["enterprise", "saas", "b2b", "sales"],
    aiSettings: {
      personalization: "high",
      toneAdjustment: true,
      industryContext: true
    }
  },

  {
    name: "Recruiting Campaign - Senior Engineers",
    description: "Hire 5 senior engineers for our AI team",
    status: "active",
    settings: {
      dailyLimit: 20,
      timezone: "America/Los_Angeles",
      sendWindow: {
        start: "10:00",
        end: "16:00"
      },
      excludeWeekends: false,
      trackOpens: true,
      trackClicks: true
    },
    sequence: [
      {
        step: 1,
        delay: 0,
        template: "Recruiting - Tech Talent",
        subject: "{{first_name}} - Exciting Senior Engineer opportunity",
        waitForReply: true
      },
      {
        step: 2,
        delay: 4,
        template: "Recruiting Follow-up",
        subject: "Re: Engineering opportunity - still interested?",
        condition: "opened_no_reply",
        body: `Hi {{first_name}},

I noticed you checked out my previous email about the Senior Engineer role at {{company}}.

Just wanted to add - we're also offering:
• Flexible work arrangements (remote, hybrid, or office)
• $20K signing bonus
• Relocation assistance if needed

The hiring manager specifically asked me to reach out to you because of your experience with {{specific_skill}}.

Even if you're happy where you are, I'd love to connect and keep you in mind for future opportunities.

Free for a quick 15-minute call this week?

{{sender_name}}`
      }
    ],
    metrics: {
      sent: 156,
      delivered: 154,
      opened: 98,
      clicked: 34,
      replied: 19,
      interviews_scheduled: 8,
      offers_made: 2
    },
    tags: ["recruiting", "engineering", "tech", "hiring"],
    aiSettings: {
      personalization: "very_high",
      toneAdjustment: true,
      useLinkedInData: true
    }
  },

  {
    name: "Agency New Business - Q1",
    description: "Target high-growth SaaS companies for marketing services",
    status: "paused",
    settings: {
      dailyLimit: 30,
      timezone: "America/Chicago",
      sendWindow: {
        start: "08:00",
        end: "18:00"
      },
      excludeWeekends: true,
      trackOpens: true,
      trackClicks: true
    },
    sequence: [
      {
        step: 1,
        delay: 0,
        template: "Agency - New Business",
        subject: "{{company}}'s marketing caught my eye",
        includeCalendarLink: true,
        waitForReply: true
      },
      {
        step: 2,
        delay: 2,
        template: "Agency Case Study",
        subject: "Case study: How we helped {{similar_company}} 3x their leads",
        condition: "opened_no_reply",
        attachments: ["case-study.pdf"],
        body: `Hi {{first_name}},

Following up on my previous note - I put together a quick case study showing exactly how we helped {{similar_company}} achieve:

📊 312% increase in qualified leads
💰 58% reduction in CAC
🚀 3.2x ROAS on paid channels

The PDF is attached, but here's the TL;DR: {{key_insight}}

Would you like to see how we could apply these strategies to {{company}}?

I have a few slots open next week: {{calendar_link}}

{{sender_name}}

P.S. - We're offering a risk-free pilot program for Q1. You only pay if we hit agreed-upon KPIs.`
      }
    ],
    metrics: {
      sent: 523,
      delivered: 498,
      opened: 287,
      clicked: 76,
      replied: 31,
      meetings_booked: 12,
      proposals_sent: 7,
      clients_won: 3
    },
    tags: ["agency", "marketing", "b2b", "saas"],
    aiSettings: {
      personalization: "high",
      competitorAnalysis: true,
      industryInsights: true
    }
  },

  {
    name: "Event Promotion - AI Summit",
    description: "Fill 200 seats for our AI Leadership Summit",
    status: "completed",
    settings: {
      dailyLimit: 100,
      timezone: "America/New_York",
      sendWindow: {
        start: "10:00",
        end: "15:00"
      },
      excludeWeekends: true,
      trackOpens: true,
      trackClicks: true
    },
    sequence: [
      {
        step: 1,
        delay: 0,
        template: "Event Invitation - VIP",
        subject: "{{first_name}}, you're invited - AI Leadership Summit 2025",
        waitForReply: false
      },
      {
        step: 2,
        delay: 7,
        template: "Event Reminder",
        subject: "Only 20 VIP spots left - AI Summit",
        condition: "opened_no_click",
        body: `Hi {{first_name}},

Quick reminder about your VIP invitation to the AI Leadership Summit.

We're down to our last 20 spots, and I wanted to make sure you had a chance to claim yours before we open registration to the general public.

As a reminder, your VIP benefits include:
✅ Complimentary ticket (normally $2,500)
✅ Executive roundtable with OpenAI leadership
✅ Priority seating at all sessions
✅ VIP networking dinner

{{cta_button}}

Best,
{{sender_name}}

P.S. - {{executive_name}} from {{peer_company}} just confirmed their attendance. It would be great to have you join the conversation.`
      }
    ],
    metrics: {
      sent: 1893,
      delivered: 1854,
      opened: 1243,
      clicked: 456,
      registered: 198,
      attended: 176
    },
    tags: ["event", "conference", "ai", "executive"],
    aiSettings: {
      personalization: "medium",
      urgencyOptimization: true,
      socialProof: true
    }
  },

  {
    name: "Customer Win-back Campaign",
    description: "Re-engage churned customers from last 6 months",
    status: "draft",
    settings: {
      dailyLimit: 40,
      timezone: "America/Los_Angeles",
      sendWindow: {
        start: "11:00",
        end: "16:00"
      },
      excludeWeekends: false,
      trackOpens: true,
      trackClicks: true
    },
    sequence: [
      {
        step: 1,
        delay: 0,
        template: "Customer Win-back",
        subject: "{{first_name}}, we miss you at ColdCopy",
        includeSpecialOffer: true,
        waitForReply: true
      },
      {
        step: 2,
        delay: 14,
        template: "Win-back Last Chance",
        subject: "Final offer inside - 50% off for 3 months",
        condition: "no_action",
        body: `Hi {{first_name}},

I wanted to follow up one last time about getting you back on ColdCopy.

Since you left, we've completely transformed the platform:
🤖 New AI writes emails 3x faster
📊 Advanced analytics you requested
🔗 Direct Salesforce & HubSpot sync

To show you how much we've improved, here's a special offer:

🎁 50% off for 3 months
🎁 Priority support
🎁 Free data migration
🎁 Success manager dedicated to your account

This offer expires in 48 hours: {{offer_link}}

Would love to have you back!

{{sender_name}}
CEO, ColdCopy

P.S. - No credit card needed to start. You can explore all the new features risk-free.`
      }
    ],
    metrics: {
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      reactivated: 0
    },
    tags: ["retention", "win-back", "customer-success"],
    aiSettings: {
      personalization: "very_high",
      sentimentAwareness: true,
      churnRiskAnalysis: true
    }
  },

  {
    name: "Partnership Development - Integration Partners",
    description: "Find integration partners for our platform",
    status: "active",
    settings: {
      dailyLimit: 15,
      timezone: "America/New_York",
      sendWindow: {
        start: "09:00",
        end: "17:00"
      },
      excludeWeekends: true,
      trackOpens: true,
      trackClicks: true
    },
    sequence: [
      {
        step: 1,
        delay: 0,
        template: "Partnership Outreach",
        subject: "Partnership opportunity - {{company}} x ColdCopy",
        body: `Hi {{first_name}},

I'm the partnerships lead at ColdCopy, and I've been really impressed with what you've built at {{company}}.

I think there's a natural synergy between our platforms:
• Your {{their_strength}} + our {{our_strength}}
• Shared customer base in {{industry}}
• Complementary use cases

We're looking to partner with best-in-class {{partner_type}} platforms, and {{company}} is at the top of our list.

Quick examples of what this could look like:
1. {{partnership_idea_1}}
2. {{partnership_idea_2}}
3. {{partnership_idea_3}}

Our current partners see an average of {{metric}} from the integration.

Worth exploring? I'd love to show you our partnership program and discuss how we can drive value for both our customer bases.

{{sender_name}}
Director of Partnerships, ColdCopy`,
        waitForReply: true
      }
    ],
    metrics: {
      sent: 67,
      delivered: 65,
      opened: 41,
      clicked: 18,
      replied: 12,
      partnerships_initiated: 4
    },
    tags: ["partnerships", "integrations", "b2b", "strategic"],
    aiSettings: {
      personalization: "high",
      companyResearch: true,
      synergyAnalysis: true
    }
  }
];