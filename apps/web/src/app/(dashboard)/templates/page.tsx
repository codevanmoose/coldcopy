import { Metadata } from 'next'
import { TemplatesPage } from '@/components/email-templates/templates-page'

export const metadata: Metadata = {
  title: 'Email Templates | ColdCopy',
  description: 'Create, manage, and customize email templates for your cold outreach campaigns',
}

export default function EmailTemplatesPage() {
  return <TemplatesPage />
}