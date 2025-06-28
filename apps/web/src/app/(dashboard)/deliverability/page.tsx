import { Metadata } from 'next'
import { DeliverabilityDashboard } from '@/components/deliverability/deliverability-dashboard'

export const metadata: Metadata = {
  title: 'Email Deliverability | ColdCopy',
  description: 'Monitor and optimize your email delivery performance with spam checking, DNS authentication, and bounce management',
}

export default function DeliverabilityPage() {
  return <DeliverabilityDashboard />
}