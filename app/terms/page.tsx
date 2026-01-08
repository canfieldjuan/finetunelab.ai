/* eslint-disable react/no-unescaped-entities */
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service | Fine-Tune Lab - Platform Usage Agreement',
  description: 'Fine-Tune Lab terms of service. Legal agreement covering platform usage, acceptable use policy, billing terms, intellectual property, and liability limitations.',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-20">
        <h1 className="text-4xl font-bold mb-4">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last Updated: December 17, 2025</p>

        <div className="prose prose-lg dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-bold mb-4">1. Agreement to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using Fine-Tune Lab ("Service", "Platform", "we", "us", or "our"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">2. Service Description</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Fine-Tune Lab provides a cloud-based platform for fine-tuning, testing, and deploying large language models (LLMs). Our services include:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Model fine-tuning with LoRA, QLoRA, DPO, and other methods</li>
              <li>Real-time training metrics and monitoring</li>
              <li>Dataset management and validation</li>
              <li>Model testing and evaluation tools</li>
              <li>One-click deployment to inference endpoints</li>
              <li>Analytics and performance tracking</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">3. Account Registration</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-6">3.1 Eligibility</h3>
            <p className="text-muted-foreground leading-relaxed">
              You must be at least 18 years old and have the legal capacity to enter into this agreement. By creating an account, you represent that all information provided is accurate and complete.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">3.2 Account Security</h3>
            <p className="text-muted-foreground leading-relaxed">
              You are responsible for:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Maintaining the confidentiality of your password</li>
              <li>All activities that occur under your account</li>
              <li>Notifying us immediately of unauthorized access</li>
              <li>Using strong passwords and enabling two-factor authentication</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">3.3 Account Termination</h3>
            <p className="text-muted-foreground leading-relaxed">
              We may suspend or terminate your account if you violate these Terms, engage in fraudulent activity, or for any other reason at our discretion.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">4. Acceptable Use Policy</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-6">4.1 Permitted Use</h3>
            <p className="text-muted-foreground leading-relaxed">
              You may use the Service for lawful purposes to train, test, and deploy AI models for your business or personal projects.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">4.2 Prohibited Activities</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              You may NOT use the Service to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Train models for illegal, harmful, or malicious purposes</li>
              <li>Generate content that violates laws or regulations</li>
              <li>Create models that produce hate speech, harassment, or discrimination</li>
              <li>Develop models for surveillance or privacy invasion without consent</li>
              <li>Generate spam, phishing, or fraudulent content</li>
              <li>Reverse engineer, decompile, or disassemble the Platform</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Resell or redistribute access without authorization</li>
              <li>Use the Service to compete with Fine-Tune Lab</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">4.3 Content Moderation</h3>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to review datasets and models for compliance. We may remove content or suspend accounts that violate these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">5. Billing and Payment</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-6">5.1 Pricing</h3>
            <p className="text-muted-foreground leading-relaxed">
              Pricing is based on GPU usage, storage, and inference costs. Current rates are available at <a href="/pricing" className="text-primary hover:underline">finetunelab.ai/pricing</a>. We reserve the right to change prices with 30 days notice.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">5.2 Payment Terms</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Charges are billed monthly in arrears</li>
              <li>Payments are processed via Stripe or approved payment processor</li>
              <li>All fees are in USD unless otherwise stated</li>
              <li>Taxes are your responsibility unless we&apos;re legally required to collect them</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">5.3 Refunds</h3>
            <p className="text-muted-foreground leading-relaxed">
              Refunds are provided at our discretion for service outages or billing errors. GPU usage charges are non-refundable once compute resources are consumed.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">5.4 Late Payment</h3>
            <p className="text-muted-foreground leading-relaxed">
              Failed payments may result in service suspension. We may charge late fees or interest on overdue amounts as permitted by law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">6. Intellectual Property</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-6">6.1 Your Content</h3>
            <p className="text-muted-foreground leading-relaxed">
              You retain all rights to your training data and fine-tuned models. By using the Service, you grant us a limited license to process your data solely to provide the Service.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">6.2 Our Platform</h3>
            <p className="text-muted-foreground leading-relaxed">
              The Platform, including all code, designs, and documentation, is owned by Fine-Tune Lab and protected by copyright, trademark, and other laws. You may not copy, modify, or distribute our intellectual property without permission.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">6.3 Third-Party Models</h3>
            <p className="text-muted-foreground leading-relaxed">
              Base models (e.g., Llama, Mistral, Qwen) are subject to their respective licenses. You are responsible for complying with model licenses.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">7. Service Availability</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-6">7.1 Uptime</h3>
            <p className="text-muted-foreground leading-relaxed">
              We strive for 99.9% uptime but do not guarantee uninterrupted service. Scheduled maintenance will be announced in advance when possible.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">7.2 Service Changes</h3>
            <p className="text-muted-foreground leading-relaxed">
              We may modify, suspend, or discontinue features at any time. We will provide notice for significant changes.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">7.3 Beta Features</h3>
            <p className="text-muted-foreground leading-relaxed">
              Beta features are provided "as is" without warranties. We may discontinue beta features without notice.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">8. Data Privacy and Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your use of the Service is also governed by our <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>. We implement security measures to protect your data but cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">9. Limitation of Liability</h2>
            
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-6 my-6">
              <p className="text-muted-foreground leading-relaxed mb-4">
                <strong className="text-foreground">IMPORTANT - READ CAREFULLY:</strong>
              </p>
              <p className="text-muted-foreground leading-relaxed">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, FINE-TUNE LAB SHALL NOT BE LIABLE FOR:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                <li>Indirect, incidental, special, or consequential damages</li>
                <li>Loss of profits, revenue, data, or business opportunities</li>
                <li>Training failures, data loss, or model performance issues</li>
                <li>Actions or content generated by your models</li>
                <li>Third-party service outages (e.g., RunPod, Supabase)</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                Our total liability shall not exceed the amount you paid in the last 12 months or $100, whichever is greater.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">10. Disclaimers</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND. WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Merchantability and fitness for a particular purpose</li>
              <li>Non-infringement of third-party rights</li>
              <li>Accuracy, reliability, or completeness of results</li>
              <li>Error-free or uninterrupted operation</li>
              <li>Security or freedom from viruses</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">11. Indemnification</h2>
            <p className="text-muted-foreground leading-relaxed">
              You agree to indemnify and hold Fine-Tune Lab harmless from any claims, damages, or expenses arising from your use of the Service, violation of these Terms, or infringement of third-party rights.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">12. Dispute Resolution</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-6">12.1 Informal Resolution</h3>
            <p className="text-muted-foreground leading-relaxed">
              Before filing a legal claim, contact us at <a href="mailto:legal@finetunelab.ai" className="text-primary hover:underline">legal@finetunelab.ai</a> to attempt informal resolution.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">12.2 Arbitration</h3>
            <p className="text-muted-foreground leading-relaxed">
              Any disputes will be resolved through binding arbitration, not in court, except for small claims court or injunctive relief.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">12.3 Governing Law</h3>
            <p className="text-muted-foreground leading-relaxed">
              These Terms are governed by the laws of [Your Jurisdiction], without regard to conflict of law principles.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">13. General Provisions</h2>
            
            <h3 className="text-xl font-semibold mb-3 mt-6">13.1 Entire Agreement</h3>
            <p className="text-muted-foreground leading-relaxed">
              These Terms constitute the entire agreement between you and Fine-Tune Lab regarding the Service.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">13.2 Severability</h3>
            <p className="text-muted-foreground leading-relaxed">
              If any provision is found unenforceable, the remaining provisions remain in full effect.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">13.3 Waiver</h3>
            <p className="text-muted-foreground leading-relaxed">
              Failure to enforce any right or provision does not constitute a waiver of future enforcement.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">13.4 Assignment</h3>
            <p className="text-muted-foreground leading-relaxed">
              You may not assign these Terms without our consent. We may assign these Terms to any successor or affiliate.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-6">13.5 Force Majeure</h3>
            <p className="text-muted-foreground leading-relaxed">
              We are not liable for failures caused by events beyond our control (e.g., natural disasters, war, strikes, internet outages).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">14. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may modify these Terms at any time. Material changes will be communicated via email or platform notification at least 30 days in advance. Continued use after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">15. Contact Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              For questions about these Terms:
            </p>
            <ul className="list-none space-y-2 text-muted-foreground mt-4">
              <li><strong>Email:</strong> <a href="mailto:legal@finetunelab.ai" className="text-primary hover:underline">legal@finetunelab.ai</a></li>
              <li><strong>Support:</strong> <a href="mailto:support@finetunelab.ai" className="text-primary hover:underline">support@finetunelab.ai</a></li>
            </ul>
          </section>

          <section className="border-t pt-8 mt-12">
            <p className="text-sm text-muted-foreground">
              By using Fine-Tune Lab, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
