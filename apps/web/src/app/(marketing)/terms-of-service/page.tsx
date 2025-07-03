import { Metadata } from 'next'
import Link from 'next/link'
import { BackToDashboardButton } from '@/components/ui/back-to-dashboard-button'

// Enable ISR with 86400 second (24 hours) revalidation for legal pages
export const revalidate = 86400

export const metadata: Metadata = {
  title: 'Terms of Service - ColdCopy',
  description: 'Read the terms and conditions for using ColdCopy\'s cold outreach automation platform.',
}

export default function TermsOfServicePage() {
  const lastUpdated = '2024-01-15'
  const effectiveDate = '2024-01-15'

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <BackToDashboardButton />
      <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
      
      <div className="prose prose-gray max-w-none">
        <p className="text-sm text-gray-600 mb-6">
          Last updated: {lastUpdated} | Effective date: {effectiveDate}
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">1. Agreement to Terms</h2>
          <p>
            By accessing or using ColdCopy's services, you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of these terms, you may not access our services.
          </p>
          <p>
            These Terms apply to all visitors, users, and others who access or use our cold outreach automation platform.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">2. Use of Our Service</h2>
          
          <h3 className="text-xl font-semibold mb-3">2.1 Eligibility</h3>
          <p>You must be at least 18 years old and capable of forming a binding contract to use our services.</p>
          
          <h3 className="text-xl font-semibold mb-3">2.2 Account Registration</h3>
          <ul className="list-disc pl-6 mb-4">
            <li>You must provide accurate and complete information</li>
            <li>You are responsible for maintaining account security</li>
            <li>You must notify us immediately of any unauthorized access</li>
            <li>One person or legal entity may not maintain more than one account</li>
          </ul>

          <h3 className="text-xl font-semibold mb-3">2.3 Acceptable Use</h3>
          <p>You agree to use ColdCopy only for lawful purposes and in accordance with these Terms. You agree not to:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>Send spam or unsolicited emails</li>
            <li>Violate any applicable laws or regulations (including CAN-SPAM, GDPR)</li>
            <li>Impersonate any person or entity</li>
            <li>Upload malicious code or interfere with the service</li>
            <li>Attempt to gain unauthorized access to any part of the service</li>
            <li>Use the service to harm minors in any way</li>
            <li>Send content that is defamatory, obscene, or offensive</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">3. Email Compliance and Best Practices</h2>
          
          <h3 className="text-xl font-semibold mb-3">3.1 Compliance Requirements</h3>
          <p>You must comply with all applicable email laws and regulations, including:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>CAN-SPAM Act (US)</li>
            <li>GDPR (European Union)</li>
            <li>CASL (Canada)</li>
            <li>Other regional email and privacy laws</li>
          </ul>

          <h3 className="text-xl font-semibold mb-3">3.2 Required Email Practices</h3>
          <ul className="list-disc pl-6 mb-4">
            <li>Include accurate sender information</li>
            <li>Use truthful subject lines</li>
            <li>Provide a clear unsubscribe mechanism</li>
            <li>Honor opt-out requests promptly</li>
            <li>Obtain necessary consents before sending</li>
          </ul>

          <h3 className="text-xl font-semibold mb-3">3.3 Prohibited Content</h3>
          <p>You may not send emails containing:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>Misleading or deceptive content</li>
            <li>Illegal products or services</li>
            <li>Adult content or services</li>
            <li>Malware, viruses, or harmful code</li>
            <li>Phishing attempts or scams</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">4. Intellectual Property Rights</h2>
          
          <h3 className="text-xl font-semibold mb-3">4.1 Our Intellectual Property</h3>
          <p>
            The service and its original content, features, and functionality are owned by ColdCopy and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
          </p>

          <h3 className="text-xl font-semibold mb-3">4.2 Your Content</h3>
          <p>
            You retain ownership of content you upload to our service. By uploading content, you grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, and display your content as necessary to provide our services.
          </p>

          <h3 className="text-xl font-semibold mb-3">4.3 Feedback</h3>
          <p>
            Any feedback, suggestions, or ideas you provide about our service become our property and may be used without compensation to you.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">5. Payment Terms</h2>
          
          <h3 className="text-xl font-semibold mb-3">5.1 Subscription Plans</h3>
          <ul className="list-disc pl-6 mb-4">
            <li>Subscriptions are billed in advance on a monthly or annual basis</li>
            <li>All fees are non-refundable except as required by law</li>
            <li>We may change our fees with 30 days' notice</li>
          </ul>

          <h3 className="text-xl font-semibold mb-3">5.2 Auto-Renewal</h3>
          <p>
            Subscriptions automatically renew unless canceled before the renewal date. You can cancel anytime through your account settings.
          </p>

          <h3 className="text-xl font-semibold mb-3">5.3 Taxes</h3>
          <p>
            You are responsible for all applicable taxes, and we will charge tax when required by law.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">6. Data Processing and Privacy</h2>
          
          <h3 className="text-xl font-semibold mb-3">6.1 Data Processing Agreement</h3>
          <p>
            When you use our service to process personal data, you act as the data controller and we act as the data processor. Our Data Processing Agreement is incorporated into these Terms.
          </p>

          <h3 className="text-xl font-semibold mb-3">6.2 Your Responsibilities</h3>
          <ul className="list-disc pl-6 mb-4">
            <li>Ensure you have lawful basis to process personal data</li>
            <li>Obtain necessary consents from data subjects</li>
            <li>Respond to data subject requests</li>
            <li>Notify us of any data breaches</li>
          </ul>

          <h3 className="text-xl font-semibold mb-3">6.3 Our Commitments</h3>
          <ul className="list-disc pl-6 mb-4">
            <li>Process data only on your instructions</li>
            <li>Implement appropriate security measures</li>
            <li>Assist with data subject requests</li>
            <li>Delete or return data upon termination</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">7. API Usage</h2>
          
          <h3 className="text-xl font-semibold mb-3">7.1 API Access</h3>
          <p>
            If we provide you with API access, you must comply with our API documentation and rate limits.
          </p>

          <h3 className="text-xl font-semibold mb-3">7.2 Restrictions</h3>
          <ul className="list-disc pl-6 mb-4">
            <li>Do not exceed rate limits</li>
            <li>Do not use the API to create a competing service</li>
            <li>Do not reverse engineer our API</li>
            <li>Do not share API credentials</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">8. Disclaimers and Limitations</h2>
          
          <h3 className="text-xl font-semibold mb-3">8.1 Service Availability</h3>
          <p>
            We strive for 99.9% uptime but do not guarantee uninterrupted service. We may modify or discontinue features with notice.
          </p>

          <h3 className="text-xl font-semibold mb-3">8.2 No Warranties</h3>
          <p>
            THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
          </p>

          <h3 className="text-xl font-semibold mb-3">8.3 Limitation of Liability</h3>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, COLDCOPY SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">9. Indemnification</h2>
          <p>
            You agree to defend, indemnify, and hold harmless ColdCopy and its officers, directors, employees, and agents from any claims, damages, or expenses arising from:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>Your use of the service</li>
            <li>Your violation of these Terms</li>
            <li>Your violation of any rights of another party</li>
            <li>Your content or emails sent through our service</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">10. Termination</h2>
          
          <h3 className="text-xl font-semibold mb-3">10.1 Termination by You</h3>
          <p>
            You may terminate your account at any time through your account settings. Termination does not entitle you to any refunds.
          </p>

          <h3 className="text-xl font-semibold mb-3">10.2 Termination by Us</h3>
          <p>
            We may suspend or terminate your account immediately for:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>Violation of these Terms</li>
            <li>Violation of applicable laws</li>
            <li>Harmful or abusive behavior</li>
            <li>Extended periods of inactivity</li>
          </ul>

          <h3 className="text-xl font-semibold mb-3">10.3 Effect of Termination</h3>
          <p>
            Upon termination, your right to use the service ceases immediately. We may delete your data after 30 days unless legally required to retain it.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">11. Dispute Resolution</h2>
          
          <h3 className="text-xl font-semibold mb-3">11.1 Informal Resolution</h3>
          <p>
            Before filing a claim, you agree to try to resolve disputes informally by contacting support@coldcopy.cc.
          </p>

          <h3 className="text-xl font-semibold mb-3">11.2 Arbitration</h3>
          <p>
            Any disputes not resolved informally shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association.
          </p>

          <h3 className="text-xl font-semibold mb-3">11.3 Governing Law</h3>
          <p>
            These Terms are governed by the laws of [Your Jurisdiction] without regard to conflict of law principles.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">12. General Provisions</h2>
          
          <h3 className="text-xl font-semibold mb-3">12.1 Entire Agreement</h3>
          <p>
            These Terms constitute the entire agreement between you and ColdCopy regarding the use of our service.
          </p>

          <h3 className="text-xl font-semibold mb-3">12.2 Severability</h3>
          <p>
            If any provision of these Terms is found to be unenforceable, the remaining provisions will continue in effect.
          </p>

          <h3 className="text-xl font-semibold mb-3">12.3 Waiver</h3>
          <p>
            Our failure to enforce any right or provision is not a waiver of that right or provision.
          </p>

          <h3 className="text-xl font-semibold mb-3">12.4 Assignment</h3>
          <p>
            You may not assign or transfer these Terms. We may assign our rights to any of our affiliates or successors.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">13. Contact Information</h2>
          <p>For questions about these Terms, please contact us at:</p>
          <div className="bg-gray-50 p-6 rounded-lg">
            <p><strong>ColdCopy Legal Team</strong></p>
            <p>Email: legal@coldcopy.cc</p>
            <p>Support: support@coldcopy.cc</p>
            <p>Address: [Your Company Address]</p>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">14. Changes to Terms</h2>
          <p>
            We reserve the right to modify these Terms at any time. We will notify users of material changes via email or through our platform. Your continued use of the service after changes constitutes acceptance of the new Terms.
          </p>
        </section>
      </div>

      <div className="mt-12 p-6 bg-primary/5 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Questions About Our Terms?</h3>
        <p className="mb-4">
          We've tried to make our terms clear and fair. If you have any questions or concerns, please reach out to us.
        </p>
        <div className="flex gap-4">
          <Link
            href="/contact"
            className="bg-primary text-white px-4 py-2 rounded hover:bg-primary/90"
          >
            Contact Support
          </Link>
          <Link
            href="/privacy-policy"
            className="border border-primary text-primary px-4 py-2 rounded hover:bg-primary/10"
          >
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  )
}