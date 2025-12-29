import type { Metadata } from 'next'
import { Mail, MessageSquare, Github, Twitter, Linkedin, Send, Clock, Users, HelpCircle } from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Contact Fine-Tune Lab | Get Support, Sales & Partnership Inquiries - AI Model Training Platform',
  description: 'Contact Fine-Tune Lab for technical support, enterprise sales, partnerships, or general inquiries. Email support@finetunelab.ai or join our Discord community. Fast response times, helpful team ready to assist with LLM fine-tuning questions.',
  keywords: [
    'Fine-Tune Lab contact',
    'AI training platform support',
    'LLM fine-tuning help',
    'enterprise AI sales contact',
    'technical support email',
    'AI platform customer service',
    'Discord community support',
    'fine-tuning troubleshooting help',
    'enterprise AI partnerships',
    'custom AI training solutions',
    'model training support team',
    'AI platform sales inquiry',
    'GPU training technical support',
    'RunPod integration help',
    'API integration support',
    'custom deployment assistance',
    'AI training consultation',
    'enterprise pricing inquiry',
    'bulk training discounts',
    'white label AI solutions',
    'AI platform reseller program',
    'model training best practices',
    'fine-tuning expert advice',
    'production AI deployment help',
    'training job troubleshooting',
    'dataset preparation assistance',
    'model evaluation guidance',
    'inference optimization support',
    'AI platform demo request',
    'enterprise onboarding assistance',
    'dedicated account manager',
    'priority support access'
  ],
  openGraph: {
    title: 'Contact Fine-Tune Lab | Support & Sales',
    description: 'Get help with LLM fine-tuning, enterprise inquiries, or technical support. Fast response times from our team.',
    type: 'website',
    url: 'https://finetunelab.ai/contact',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contact Fine-Tune Lab | Support & Sales',
    description: 'Get help with LLM fine-tuning, enterprise inquiries, or technical support. Fast response times from our team.',
  },
}

export default function ContactPage() {
  const contactMethods = [
    {
      icon: Mail,
      title: 'Email Support',
      description: 'General inquiries and technical support',
      contact: 'support@finetunelab.ai',
      action: 'mailto:support@finetunelab.ai',
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      response: 'Response within 2-4 hours',
    },
    {
      icon: MessageSquare,
      title: 'Discord Community',
      description: 'Chat with the community and get quick help',
      contact: 'Join Discord Server',
      action: 'https://discord.gg/finetunelab',
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      response: 'Real-time community support',
    },
    {
      icon: Users,
      title: 'Enterprise Sales',
      description: 'Custom solutions and volume pricing',
      contact: 'sales@finetunelab.ai',
      action: 'mailto:sales@finetunelab.ai',
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      response: 'Response within 1 business day',
    },
  ]

  const faqs = [
    {
      question: 'What are your support hours?',
      answer: 'Email support is monitored 24/7 with response times typically under 2-4 hours. Discord community is active around the clock.',
    },
    {
      question: 'Do you offer enterprise support?',
      answer: 'Yes! Enterprise customers get dedicated account managers, priority support, custom SLAs, and direct access to our engineering team.',
    },
    {
      question: 'Can I schedule a demo?',
      answer: 'Absolutely! Email sales@finetunelab.ai to schedule a personalized demo and discuss your specific use case.',
    },
    {
      question: 'How do I report a bug?',
      answer: 'Email support@finetunelab.ai with details about the issue, or report it in our Discord #bugs channel. Include any error messages and steps to reproduce.',
    },
    {
      question: 'Do you offer custom integrations?',
      answer: 'Yes! We work with enterprise customers to build custom integrations, white-label solutions, and tailored workflows. Contact sales@finetunelab.ai.',
    },
    {
      question: 'How can I provide feedback?',
      answer: 'We love feedback! Share suggestions via email, Discord, or directly in the platform. Feature requests often make it into production within weeks.',
    },
  ]

  const socialLinks = [
    {
      icon: Github,
      name: 'GitHub',
      href: 'https://github.com/finetunelab',
      color: 'hover:text-gray-600',
    },
    {
      icon: Twitter,
      name: 'Twitter',
      href: 'https://twitter.com/finetunelab',
      color: 'hover:text-blue-400',
    },
    {
      icon: Linkedin,
      name: 'LinkedIn',
      href: 'https://linkedin.com/company/finetunelab',
      color: 'hover:text-blue-600',
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative py-20 px-4 border-b">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Get in Touch
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Whether you need technical support, want to discuss enterprise solutions, or just have questions about fine-tuning, we&apos;re here to help.
          </p>
        </div>
      </section>

      {/* Contact Methods */}
      <section className="py-20 px-4 border-b">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-center">How Can We Help?</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Choose the best way to reach us based on your needs
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {contactMethods.map((method, index) => {
              const Icon = method.icon
              return (
                <a
                  key={index}
                  href={method.action}
                  target={method.action.startsWith('http') ? '_blank' : undefined}
                  rel={method.action.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className="bg-background p-6 rounded-lg border hover:shadow-lg transition-all group"
                >
                  <div className={`${method.bgColor} w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon className={`w-6 h-6 ${method.color}`} />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{method.title}</h3>
                  <p className="text-muted-foreground mb-4 text-sm">
                    {method.description}
                  </p>
                  <div className="flex items-center gap-2 text-sm font-medium text-primary mb-2">
                    <Send className="w-4 h-4" />
                    <span>{method.contact}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>{method.response}</span>
                  </div>
                </a>
              )
            })}
          </div>
        </div>
      </section>

      {/* Office/Location Info */}
      <section className="py-20 px-4 border-b bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <h2 className="text-2xl font-bold mb-4">Quick Response Times</h2>
              <p className="text-muted-foreground mb-6">
                We pride ourselves on being responsive. Most support emails get answered within 2-4 hours, and our Discord community is active 24/7.
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                    <Mail className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Email</h3>
                    <p className="text-sm text-muted-foreground">support@finetunelab.ai</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                    <MessageSquare className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Discord</h3>
                    <p className="text-sm text-muted-foreground">Real-time chat support</p>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-4">Enterprise Support</h2>
              <p className="text-muted-foreground mb-6">
                Need custom solutions, dedicated support, or volume pricing? Our enterprise team is ready to help.
              </p>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Dedicated account manager</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Custom SLA agreements</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Priority support queue</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Custom integrations & features</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Volume discounts</span>
                </li>
              </ul>
              <a
                href="mailto:sales@finetunelab.ai"
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 mt-6"
              >
                Contact Sales
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-20 px-4 border-b">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-4">
            <HelpCircle className="w-8 h-8 text-primary" />
            <h2 className="text-3xl md:text-4xl font-bold text-center">Frequently Asked Questions</h2>
          </div>
          <p className="text-center text-muted-foreground mb-12">
            Quick answers to common questions
          </p>
          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <div key={index} className="border rounded-lg p-6 bg-background">
                <h3 className="text-lg font-bold mb-3">{faq.question}</h3>
                <p className="text-muted-foreground">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Links */}
      <section className="py-20 px-4 border-b bg-muted/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Connect With Us</h2>
          <p className="text-muted-foreground mb-8">
            Follow us on social media for updates, tips, and community highlights
          </p>
          <div className="flex justify-center gap-6">
            {socialLinks.map((social, index) => {
              const Icon = social.icon
              return (
                <a
                  key={index}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-12 h-12 rounded-lg border bg-background flex items-center justify-center transition-colors ${social.color}`}
                  aria-label={social.name}
                >
                  <Icon className="w-6 h-6" />
                </a>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Get Started?</h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Train your first model in under 2 minutes. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login" className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 h-11 rounded-md px-8">
              Start Training Free
            </Link>
            <Link href="/docs" className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer border border-input bg-background hover:bg-accent hover:text-accent-foreground h-11 rounded-md px-8">
              View Documentation
            </Link>
          </div>
        </div>
      </section>

      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ContactPage',
            name: 'Contact Fine-Tune Lab',
            description: 'Contact Fine-Tune Lab for technical support, enterprise sales, partnerships, and general inquiries about LLM fine-tuning platform.',
            url: 'https://finetunelab.ai/contact',
            mainEntity: {
              '@type': 'Organization',
              name: 'Fine-Tune Lab',
              url: 'https://finetunelab.ai',
              contactPoint: [
                {
                  '@type': 'ContactPoint',
                  contactType: 'Customer Support',
                  email: 'support@finetunelab.ai',
                  availableLanguage: 'English',
                  areaServed: 'Worldwide'
                },
                {
                  '@type': 'ContactPoint',
                  contactType: 'Sales',
                  email: 'sales@finetunelab.ai',
                  availableLanguage: 'English',
                  areaServed: 'Worldwide'
                }
              ],
              sameAs: [
                'https://github.com/finetunelab',
                'https://twitter.com/finetunelab',
                'https://linkedin.com/company/finetunelab',
                'https://discord.gg/finetunelab'
              ]
            }
          })
        }}
      />
    </div>
  )
}
