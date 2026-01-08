/* eslint-disable react/no-unescaped-entities */
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy | Fine-Tune Lab - How We Protect Your Data',
  description: 'Fine-Tune Lab privacy policy. Learn how we collect, use, and protect your data. GDPR compliant. Your training data remains private and is never used to train other models.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-20">
        <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last Updated: December 17, 2025</p>

        <div className="prose prose-lg dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-bold mb-4">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              Fine-Tune Lab ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI model fine-tuning platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">2. Information We Collect</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-6">2.1 Account Information</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Email address</li>
              <li>Name (optional)</li>
              <li>Company information (optional)</li>
              <li>Password (encrypted)</li>
              <li>Profile preferences</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">2.2 Usage Data</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Training job metrics and logs</li>
              <li>Model performance data</li>
              <li>API usage statistics</li>
              <li>Feature usage patterns</li>
              <li>Error logs and debugging information</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">2.3 Training Data</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Datasets you upload for fine-tuning</li>
              <li>Model configurations and hyperparameters</li>
              <li>Training checkpoints</li>
              <li>Inference logs (if enabled)</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">2.4 Technical Information</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>IP address</li>
              <li>Browser type and version</li>
              <li>Device information</li>
              <li>Operating system</li>
              <li>Cookies and similar technologies</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li><strong>Service Delivery:</strong> To provide, maintain, and improve our platform</li>
              <li><strong>Training Jobs:</strong> To execute your fine-tuning jobs on cloud infrastructure</li>
              <li><strong>Support:</strong> To respond to your questions and provide technical assistance</li>
              <li><strong>Analytics:</strong> To understand usage patterns and optimize performance</li>
              <li><strong>Security:</strong> To detect and prevent fraud, abuse, and security threats</li>
              <li><strong>Communication:</strong> To send service updates, security alerts, and account notifications</li>
              <li><strong>Compliance:</strong> To comply with legal obligations and enforce our terms</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">4. Your Training Data Privacy</h2>
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 my-6">
              <p className="text-muted-foreground leading-relaxed mb-4">
                <strong className="text-foreground">We Never Use Your Data to Train Models:</strong>
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Your training datasets are used ONLY for your fine-tuning jobs</li>
                <li>We do not use your data to improve our platform or train other models</li>
                <li>Your data is not shared with other users</li>
                <li>Training data is encrypted at rest and in transit</li>
                <li>You can delete your data at any time</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">5. Data Sharing and Disclosure</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-6">5.1 Third-Party Services</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We use the following third-party services:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li><strong>Supabase:</strong> Authentication and database hosting</li>
              <li><strong>RunPod:</strong> GPU infrastructure for training jobs</li>
              <li><strong>Vercel:</strong> Web hosting and deployment</li>
              <li><strong>Payment Processors:</strong> For billing (e.g., Stripe)</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">5.2 When We Share Data</h3>
            <p className="text-muted-foreground leading-relaxed">
              We may disclose your information when:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Required by law or legal process</li>
              <li>Necessary to protect our rights or property</li>
              <li>In connection with a merger, acquisition, or sale of assets</li>
              <li>With your explicit consent</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">6. Data Retention</h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li><strong>Account Data:</strong> Retained while your account is active</li>
              <li><strong>Training Data:</strong> Deleted when you delete datasets or close your account</li>
              <li><strong>Usage Logs:</strong> Retained for 90 days for debugging and analytics</li>
              <li><strong>Billing Records:</strong> Retained for 7 years for tax compliance</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">7. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              You have the right to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Correction:</strong> Update or correct inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your data (&quot;right to be forgotten&quot;)</li>
              <li><strong>Portability:</strong> Export your data in a machine-readable format</li>
              <li><strong>Objection:</strong> Object to processing of your data</li>
              <li><strong>Restriction:</strong> Request restriction of processing</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              To exercise these rights, contact us at <a href="mailto:privacy@finetunelab.ai" className="text-primary hover:underline">privacy@finetunelab.ai</a>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">8. Security</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We implement industry-standard security measures:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Encryption at rest (AES-256) and in transit (TLS 1.3)</li>
              <li>Regular security audits and penetration testing</li>
              <li>Role-based access controls</li>
              <li>Multi-factor authentication support</li>
              <li>Automated backup and disaster recovery</li>
              <li>SOC 2 Type II compliance (in progress)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">9. Cookies and Tracking</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We use cookies for:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li><strong>Essential:</strong> Authentication and session management</li>
              <li><strong>Functional:</strong> User preferences and settings</li>
              <li><strong>Analytics:</strong> Usage statistics (anonymized)</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              You can control cookies through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">10. International Data Transfers</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your data may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place, including Standard Contractual Clauses (SCCs) approved by the European Commission.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">11. Children&apos;s Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our service is not intended for users under 18. We do not knowingly collect information from children. If you believe we have collected data from a child, contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">12. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy periodically. We will notify you of significant changes via email or platform notification. Continued use of our service after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">13. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              For privacy-related questions or concerns:
            </p>
            <ul className="list-none space-y-2 text-muted-foreground mt-4">
              <li><strong>Email:</strong> <a href="mailto:privacy@finetunelab.ai" className="text-primary hover:underline">privacy@finetunelab.ai</a></li>
              <li><strong>Support:</strong> <a href="mailto:support@finetunelab.ai" className="text-primary hover:underline">support@finetunelab.ai</a></li>
            </ul>
          </section>

          <section className="border-t pt-8 mt-12">
            <h2 className="text-2xl font-bold mb-4">GDPR Compliance</h2>
            <p className="text-muted-foreground leading-relaxed">
              Fine-Tune Lab is committed to GDPR compliance. We process data lawfully, transparently, and for specific purposes. EU users have additional rights under GDPR, including the right to lodge a complaint with a supervisory authority.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
