import { EmailTemplate } from './types'

export const sampleTemplates: EmailTemplate[] = [
  {
    id: 'sample-welcome',
    name: 'Welcome Email',
    subject: 'Welcome to {{company}}!',
    blocks: [
      {
        id: 'logo-1',
        type: 'logo',
        styles: {
          textAlign: 'center',
          padding: '32px 16px 16px 16px',
          width: '200px',
        },
        settings: {
          src: 'https://via.placeholder.com/200x60/4F46E5/FFFFFF?text=Your+Logo',
          alt: 'Company Logo',
        },
      },
      {
        id: 'heading-1',
        type: 'heading',
        content: 'Welcome to our community!',
        styles: {
          fontSize: '28px',
          fontWeight: 'bold',
          textColor: '#1F2937',
          textAlign: 'center',
          padding: '16px',
        },
      },
      {
        id: 'text-1',
        type: 'text',
        content: 'Hi {{first_name}},\n\nThank you for joining {{company}}! We\'re excited to have you on board and can\'t wait to help you achieve your goals.\n\nHere\'s what you can expect in the coming days:',
        styles: {
          fontSize: '16px',
          textColor: '#374151',
          padding: '16px',
          lineHeight: '1.6',
        },
      },
      {
        id: 'text-2',
        type: 'text',
        content: '• A personalized onboarding email\n• Access to our resource library\n• Invitation to our community forum\n• Tips and best practices from our team',
        styles: {
          fontSize: '16px',
          textColor: '#374151',
          padding: '0 16px 16px 32px',
          lineHeight: '1.8',
        },
      },
      {
        id: 'button-1',
        type: 'button',
        content: 'Get Started',
        styles: {
          backgroundColor: '#4F46E5',
          textColor: '#FFFFFF',
          fontSize: '16px',
          fontWeight: 'bold',
          borderRadius: '8px',
          textAlign: 'center',
          padding: '24px 16px',
        },
        settings: {
          href: 'https://example.com/get-started',
          target: '_blank',
        },
      },
      {
        id: 'divider-1',
        type: 'divider',
        styles: {
          borderColor: '#E5E7EB',
          borderWidth: '1px',
          margin: '32px 16px',
        },
      },
      {
        id: 'text-3',
        type: 'text',
        content: 'If you have any questions, don\'t hesitate to reach out to our support team at support@{{company}}.com.\n\nBest regards,\nThe {{company}} Team',
        styles: {
          fontSize: '14px',
          textColor: '#6B7280',
          padding: '16px',
          textAlign: 'center',
        },
      },
    ],
    variables: [],
    globalStyles: {
      backgroundColor: '#F9FAFB',
      fontFamily: 'Arial, sans-serif',
      maxWidth: '600px',
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'sample-newsletter',
    name: 'Newsletter Template',
    subject: '{{company}} Newsletter - {{month}} Edition',
    blocks: [
      {
        id: 'header-1',
        type: 'heading',
        content: '{{company}} Newsletter',
        styles: {
          fontSize: '32px',
          fontWeight: 'bold',
          textColor: '#FFFFFF',
          textAlign: 'center',
          padding: '32px 16px',
          backgroundColor: '#1F2937',
        },
      },
      {
        id: 'text-1',
        type: 'text',
        content: 'Hello {{first_name}},\n\nWelcome to this month\'s edition of our newsletter! We\'ve got some exciting updates to share with you.',
        styles: {
          fontSize: '16px',
          textColor: '#374151',
          padding: '24px 16px 16px 16px',
        },
      },
      {
        id: 'heading-2',
        type: 'heading',
        content: 'Featured Article',
        styles: {
          fontSize: '20px',
          fontWeight: 'bold',
          textColor: '#1F2937',
          padding: '24px 16px 8px 16px',
        },
      },
      {
        id: 'image-1',
        type: 'image',
        styles: {
          textAlign: 'center',
          padding: '16px',
        },
        settings: {
          src: 'https://via.placeholder.com/600x300/E5E7EB/6B7280?text=Featured+Article',
          alt: 'Featured Article',
        },
      },
      {
        id: 'text-2',
        type: 'text',
        content: 'Learn about the latest trends and best practices in our industry. This comprehensive guide will help you stay ahead of the curve.',
        styles: {
          fontSize: '16px',
          textColor: '#374151',
          padding: '8px 16px 16px 16px',
        },
      },
      {
        id: 'button-1',
        type: 'button',
        content: 'Read Full Article',
        styles: {
          backgroundColor: '#059669',
          textColor: '#FFFFFF',
          fontSize: '16px',
          fontWeight: 'bold',
          borderRadius: '6px',
          textAlign: 'center',
          padding: '16px',
        },
        settings: {
          href: 'https://example.com/article',
          target: '_blank',
        },
      },
      {
        id: 'spacer-1',
        type: 'spacer',
        styles: {
          height: '32px',
        },
      },
      {
        id: 'divider-1',
        type: 'divider',
        styles: {
          borderColor: '#E5E7EB',
          borderWidth: '1px',
          margin: '0 16px',
        },
      },
      {
        id: 'text-3',
        type: 'text',
        content: 'Thanks for reading!\n\nBest,\nThe {{company}} Team\n\n---\n\nYou received this email because you subscribed to our newsletter. If you no longer wish to receive these emails, you can unsubscribe at any time.',
        styles: {
          fontSize: '14px',
          textColor: '#6B7280',
          padding: '24px 16px',
          textAlign: 'center',
        },
      },
    ],
    variables: [
      {
        id: 'month',
        name: 'Month',
        placeholder: '{{month}}',
        type: 'text',
        required: false,
      },
    ],
    globalStyles: {
      backgroundColor: '#FFFFFF',
      fontFamily: 'Arial, sans-serif',
      maxWidth: '600px',
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'sample-outreach',
    name: 'Cold Outreach',
    subject: 'Quick question about {{company}}',
    blocks: [
      {
        id: 'text-1',
        type: 'text',
        content: 'Hi {{first_name}},\n\nI hope this email finds you well. I came across {{company}} and was impressed by {{specific_detail}}.\n\nI wanted to reach out because I believe we could help {{company}} achieve {{goal}} through our {{solution}}.',
        styles: {
          fontSize: '16px',
          textColor: '#374151',
          padding: '24px 16px 16px 16px',
          lineHeight: '1.6',
        },
      },
      {
        id: 'text-2',
        type: 'text',
        content: 'We\'ve helped similar companies like {{competitor_example}} increase their {{metric}} by {{percentage}}% in just {{timeframe}}.',
        styles: {
          fontSize: '16px',
          textColor: '#374151',
          padding: '16px',
          lineHeight: '1.6',
        },
      },
      {
        id: 'text-3',
        type: 'text',
        content: 'Would you be open to a brief 15-minute call next week to discuss how we might be able to help {{company}}?',
        styles: {
          fontSize: '16px',
          textColor: '#374151',
          padding: '16px',
          lineHeight: '1.6',
        },
      },
      {
        id: 'button-1',
        type: 'button',
        content: 'Schedule a Call',
        styles: {
          backgroundColor: '#DC2626',
          textColor: '#FFFFFF',
          fontSize: '16px',
          fontWeight: 'bold',
          borderRadius: '6px',
          textAlign: 'center',
          padding: '20px 16px',
        },
        settings: {
          href: 'https://calendly.com/example',
          target: '_blank',
        },
      },
      {
        id: 'text-4',
        type: 'text',
        content: 'Best regards,\n{{sender_name}}\n{{sender_title}}\n{{sender_company}}',
        styles: {
          fontSize: '16px',
          textColor: '#374151',
          padding: '24px 16px',
          lineHeight: '1.6',
        },
      },
    ],
    variables: [
      {
        id: 'specific_detail',
        name: 'Specific Detail',
        placeholder: '{{specific_detail}}',
        type: 'text',
        required: false,
      },
      {
        id: 'goal',
        name: 'Goal',
        placeholder: '{{goal}}',
        type: 'text',
        required: false,
      },
      {
        id: 'solution',
        name: 'Solution',
        placeholder: '{{solution}}',
        type: 'text',
        required: false,
      },
      {
        id: 'competitor_example',
        name: 'Competitor Example',
        placeholder: '{{competitor_example}}',
        type: 'text',
        required: false,
      },
      {
        id: 'metric',
        name: 'Metric',
        placeholder: '{{metric}}',
        type: 'text',
        required: false,
      },
      {
        id: 'percentage',
        name: 'Percentage',
        placeholder: '{{percentage}}',
        type: 'number',
        required: false,
      },
      {
        id: 'timeframe',
        name: 'Timeframe',
        placeholder: '{{timeframe}}',
        type: 'text',
        required: false,
      },
      {
        id: 'sender_name',
        name: 'Sender Name',
        placeholder: '{{sender_name}}',
        type: 'text',
        required: false,
      },
      {
        id: 'sender_title',
        name: 'Sender Title',
        placeholder: '{{sender_title}}',
        type: 'text',
        required: false,
      },
      {
        id: 'sender_company',
        name: 'Sender Company',
        placeholder: '{{sender_company}}',
        type: 'text',
        required: false,
      },
    ],
    globalStyles: {
      backgroundColor: '#FFFFFF',
      fontFamily: 'Arial, sans-serif',
      maxWidth: '600px',
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
]

export function createSampleTemplates() {
  sampleTemplates.forEach(template => {
    const existingTemplate = localStorage.getItem(`template-${template.id}`)
    if (!existingTemplate) {
      localStorage.setItem(`template-${template.id}`, JSON.stringify(template))
    }
  })
}