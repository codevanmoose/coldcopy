import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy - ColdCopy',
  description: 'Learn how ColdCopy collects, uses, and protects your personal information.',
}

export default function PrivacyPolicyPage() {
  const lastUpdated = '2024-01-15'
  const effectiveDate = '2024-01-15'

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
      
      <div className="prose prose-gray max-w-none">
        <p className="text-sm text-gray-600 mb-6">
          Last updated: {lastUpdated} | Effective date: {effectiveDate}
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
          <p>
            ColdCopy ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our cold outreach automation platform.
          </p>
          <p>
            We comply with the General Data Protection Regulation (GDPR) and other applicable data protection laws. By using our services, you consent to the data practices described in this policy.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>
          
          <h3 className="text-xl font-semibold mb-3">2.1 Information You Provide</h3>
          <ul className="list-disc pl-6 mb-4">
            <li>Account information (name, email, company details)</li>
            <li>Payment information (processed securely through Stripe)</li>
            <li>Lead data you upload or import</li>
            <li>Email content and campaigns you create</li>
            <li>Communication preferences and settings</li>
          </ul>

          <h3 className="text-xl font-semibold mb-3">2.2 Information We Collect Automatically</h3>
          <ul className="list-disc pl-6 mb-4">
            <li>Usage data and analytics</li>
            <li>Device and browser information</li>
            <li>IP addresses and location data</li>
            <li>Cookies and similar tracking technologies</li>
            <li>Email engagement metrics (opens, clicks)</li>
          </ul>

          <h3 className="text-xl font-semibold mb-3">2.3 Information from Third Parties</h3>
          <ul className="list-disc pl-6 mb-4">
            <li>Enrichment data from authorized providers</li>
            <li>Social media profiles (when connected)</li>
            <li>CRM integration data</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">3. Legal Basis for Processing (GDPR)</h2>
          <p>We process your personal data based on the following legal grounds:</p>
          <ul className="list-disc pl-6 mb-4">
            <li><strong>Contract:</strong> To provide our services and fulfill our agreement with you</li>
            <li><strong>Consent:</strong> For marketing communications and optional features</li>
            <li><strong>Legitimate Interests:</strong> For business operations, security, and service improvement</li>
            <li><strong>Legal Obligation:</strong> To comply with applicable laws and regulations</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">4. How We Use Your Information</h2>
          <ul className="list-disc pl-6 mb-4">
            <li>Provide and maintain our services</li>
            <li>Process transactions and send related information</li>
            <li>Send administrative and technical notices</li>
            <li>Respond to your comments and questions</li>
            <li>Analyze usage and improve our services</li>
            <li>Detect and prevent fraud or abuse</li>
            <li>Comply with legal obligations</li>
            <li>Send marketing communications (with consent)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">5. How We Share Your Information</h2>
          <p>We may share your information in the following circumstances:</p>
          
          <h3 className="text-xl font-semibold mb-3">5.1 Service Providers</h3>
          <ul className="list-disc pl-6 mb-4">
            <li>Hosting providers (Vercel, Digital Ocean)</li>
            <li>Database services (Supabase)</li>
            <li>Email delivery services (Amazon SES)</li>
            <li>Payment processors (Stripe)</li>
            <li>Analytics providers (with consent)</li>
          </ul>

          <h3 className="text-xl font-semibold mb-3">5.2 Business Transfers</h3>
          <p>
            In case of merger, acquisition, or sale of assets, your information may be transferred to the acquiring entity.
          </p>

          <h3 className="text-xl font-semibold mb-3">5.3 Legal Requirements</h3>
          <p>
            We may disclose information when required by law, court order, or to protect our rights and safety.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">6. Your Data Protection Rights (GDPR)</h2>
          <p>Under GDPR, you have the following rights:</p>
          
          <div className="bg-gray-50 p-6 rounded-lg mb-4">
            <h3 className="text-xl font-semibold mb-3">Your Rights Include:</h3>
            <ul className="list-disc pl-6">
              <li><strong>Right to Access:</strong> Request a copy of your personal data</li>
              <li><strong>Right to Rectification:</strong> Request correction of inaccurate data</li>
              <li><strong>Right to Erasure:</strong> Request deletion of your data ("right to be forgotten")</li>
              <li><strong>Right to Restriction:</strong> Request limited processing of your data</li>
              <li><strong>Right to Portability:</strong> Receive your data in a portable format</li>
              <li><strong>Right to Object:</strong> Object to certain types of processing</li>
              <li><strong>Right to Withdraw Consent:</strong> Withdraw consent at any time</li>
              <li><strong>Right to Complain:</strong> Lodge a complaint with supervisory authorities</li>
            </ul>
          </div>
          
          <p>
            To exercise any of these rights, please visit your{' '}
            <Link href="/settings/privacy" className="text-primary hover:underline">
              Privacy Settings
            </Link>{' '}
            or contact us at privacy@coldcopy.cc.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">7. Data Retention</h2>
          <p>We retain your personal data for as long as necessary to provide our services and comply with legal obligations:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>Account data: Until account deletion + 30 days</li>
            <li>Email campaign data: 2 years</li>
            <li>Analytics data: 1 year</li>
            <li>Financial records: 7 years (legal requirement)</li>
            <li>Marketing consent: Until withdrawn</li>
          </ul>
          <p>
            You can request deletion of your data at any time, subject to legal retention requirements.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">8. International Data Transfers</h2>
          <p>
            Your data may be transferred to and processed in countries outside the European Economic Area (EEA). We ensure appropriate safeguards are in place:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>Standard Contractual Clauses (SCCs) with service providers</li>
            <li>Adequacy decisions by the European Commission</li>
            <li>Your explicit consent for specific transfers</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">9. Security Measures</h2>
          <p>We implement appropriate technical and organizational measures to protect your data:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>Encryption in transit and at rest</li>
            <li>Regular security assessments</li>
            <li>Access controls and authentication</li>
            <li>Employee training and confidentiality agreements</li>
            <li>Incident response procedures</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">10. Cookies and Tracking</h2>
          <p>
            We use cookies and similar technologies to improve your experience. You can manage cookie preferences through our cookie banner or browser settings.
          </p>
          
          <h3 className="text-xl font-semibold mb-3">Types of Cookies We Use:</h3>
          <ul className="list-disc pl-6 mb-4">
            <li><strong>Essential:</strong> Required for basic functionality</li>
            <li><strong>Functional:</strong> Remember your preferences</li>
            <li><strong>Analytics:</strong> Understand usage patterns (with consent)</li>
            <li><strong>Marketing:</strong> Personalized advertising (with consent)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">11. Children's Privacy</h2>
          <p>
            Our services are not intended for children under 16. We do not knowingly collect personal information from children. If you believe we have collected such information, please contact us immediately.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">12. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of material changes via email or through our platform. The "Last updated" date at the top indicates the most recent revision.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">13. Contact Information</h2>
          <p>For privacy-related questions or to exercise your rights, contact us at:</p>
          <div className="bg-gray-50 p-6 rounded-lg">
            <p><strong>ColdCopy Privacy Team</strong></p>
            <p>Email: privacy@coldcopy.cc</p>
            <p>Address: [Your Company Address]</p>
            <p>Data Protection Officer: dpo@coldcopy.cc</p>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">14. Supervisory Authority</h2>
          <p>
            If you are in the EEA and believe we have not adequately addressed your concerns, you have the right to lodge a complaint with your local data protection authority.
          </p>
        </section>
      </div>

      <div className="mt-12 p-6 bg-primary/5 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Have Questions?</h3>
        <p className="mb-4">
          We're committed to transparency and protecting your privacy. If you have any questions about this policy or how we handle your data, please don't hesitate to contact us.
        </p>
        <div className="flex gap-4">
          <Link
            href="/settings/privacy"
            className="bg-primary text-white px-4 py-2 rounded hover:bg-primary/90"
          >
            Manage Privacy Settings
          </Link>
          <Link
            href="/contact"
            className="border border-primary text-primary px-4 py-2 rounded hover:bg-primary/10"
          >
            Contact Us
          </Link>
        </div>
      </div>
    </div>
  )
}