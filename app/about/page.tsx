import type { Metadata } from 'next'
import { Target, Users, Rocket, Heart, Award, Globe, Code, Zap, TrendingUp, Shield } from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'About Fine-Tune Lab | Mission to Democratize AI Model Training & LLM Fine-Tuning for Everyone',
  description: 'Fine-Tune Lab makes enterprise-grade LLM fine-tuning accessible to developers, startups, and enterprises. Founded to eliminate complexity in AI model training with real-time monitoring, automated testing, and one-click deployment. Learn our story, mission, and values.',
  keywords: [
    'Fine-Tune Lab company',
    'AI fine-tuning startup',
    'LLM training platform company',
    'democratize AI training',
    'accessible machine learning',
    'enterprise AI fine-tuning',
    'AI model training mission',
    'developer-first AI platform',
    'transparent AI pricing',
    'open source AI tools',
    'AI startup story',
    'LLM fine-tuning company',
    'machine learning platform founders',
    'AI training accessibility',
    'enterprise AI solutions',
    'production AI platform',
    'AI model deployment company',
    'GPU training infrastructure',
    'AI observability platform',
    'LLM testing framework',
    'AI developer tools company',
    'model fine-tuning service',
    'AI training automation',
    'machine learning SaaS',
    'AI platform reliability',
    'enterprise AI support',
    'AI training best practices',
    'LLM deployment expertise',
    'AI model monitoring company',
    'production AI infrastructure',
    'AI training community',
    'developer AI education'
  ],
  openGraph: {
    title: 'About Fine-Tune Lab | Democratizing AI Model Training',
    description: 'Making enterprise-grade LLM fine-tuning accessible to everyone. Learn our mission, values, and story.',
    type: 'website',
    url: 'https://finetunelab.ai/about',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About Fine-Tune Lab | Democratizing AI Model Training',
    description: 'Making enterprise-grade LLM fine-tuning accessible to everyone. Learn our mission, values, and story.',
  },
}

export default function AboutPage() {
  const stats = [
    { label: 'Platform Uptime', value: '99.9%', icon: Shield },
    { label: 'Avg Response Time', value: '<2h', icon: Zap },
    { label: 'Supported Models', value: '15+', icon: Rocket },
    { label: 'GPU Options', value: '8+', icon: Target },
  ]

  const values = [
    {
      icon: Target,
      title: 'Born from Necessity',
      description: 'Built by one developer who needed to test fine-tuned models and found the process incredibly difficult. Every feature solves a real problem I faced.',
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      icon: Heart,
      title: 'Accessibility',
      description: 'Enterprise-grade AI training should be available to everyone, not just companies with ML teams and massive budgets.',
      color: 'text-pink-500',
      bgColor: 'bg-pink-500/10',
    },
    {
      icon: Code,
      title: 'Transparency',
      description: 'No hidden costs, no confusing pricing. Real-time metrics, open documentation, and honest communication.',
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      icon: Zap,
      title: 'Speed',
      description: 'From dataset upload to production deployment in under 2 minutes. Because your time matters.',
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
    },
    {
      icon: TrendingUp,
      title: 'Quality',
      description: 'Real-time monitoring, automated testing, LLM-as-judge evaluation. Ship models you can trust.',
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      icon: Award,
      title: 'Excellence',
      description: 'We obsess over details. From API design to error messages, everything is crafted with care.',
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
  ]

  const milestones = [
    {
      year: 'Aug 2025',
      title: 'Day One',
      description: 'Started building on a 4-core, 4-thread Linux machine. Just me, frustrated with fine-tuning complexity.',
    },
    {
      year: 'Sep 2025',
      title: 'First Training',
      description: 'Successfully trained and tested my first model end-to-end. The platform actually worked.',
    },
    {
      year: 'Oct 2025',
      title: 'Real-Time Metrics',
      description: 'Added WebSocket streaming for live training updates. No more refreshing tabs.',
    },
    {
      year: 'Nov 2025',
      title: 'Production Features',
      description: 'Built GraphRAG testing, analytics dashboard, and automated deployment pipeline.',
    },
    {
      year: 'Dec 2025',
      title: 'Today',
      description: 'From a 4-core Linux box to a full production platform in 4 months.',
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative py-20 px-4 border-b">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Making AI Training
            <br />
            <span className="text-primary">Accessible to Everyone</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            We believe enterprise-grade LLM fine-tuning shouldn&apos;t require a PhD, a dedicated ML team, or a six-figure budget.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-4 border-b">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => {
              const Icon = stat.icon
              return (
                <div key={index} className="text-center">
                  <div className="flex justify-center mb-3">
                    <Icon className="w-8 h-8 text-primary" />
                  </div>
                  <div className="text-3xl md:text-4xl font-bold mb-2">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 px-4 border-b">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-center">Our Mission</h2>
          <div className="prose prose-lg dark:prose-invert mx-auto">
            <p className="text-lg text-muted-foreground leading-relaxed mb-6">
              Fine-Tune Lab was born from frustration. We spent months trying to fine-tune models for production and hit the same walls everyone else does:
            </p>
            <ul className="space-y-3 text-muted-foreground mb-6">
              <li>❌ Scattered documentation across 10+ different tools</li>
              <li>❌ No visibility into what&apos;s happening during training</li>
              <li>❌ Days spent debugging NaN loss and OOM errors</li>
              <li>❌ Manual deployment scripts that break every other week</li>
              <li>❌ Testing models by manually copying API keys around</li>
            </ul>
            <p className="text-lg text-muted-foreground leading-relaxed mb-6">
              We built Fine-Tune Lab to fix all of this. One platform where you upload a dataset, see training happen in real-time, test your model with actual context, and deploy to production with one click.
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed">
              <strong>Our goal is simple:</strong> Make fine-tuning so easy that any developer can train a production-ready model in under 2 minutes.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 px-4 border-b bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-center">Our Values</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            These aren&apos;t just words on a page. They guide every decision we make, from feature design to customer support.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {values.map((value, index) => {
              const Icon = value.icon
              return (
                <div key={index} className="bg-background p-6 rounded-lg border hover:shadow-lg transition-shadow">
                  <div className={`${value.bgColor} w-12 h-12 rounded-lg flex items-center justify-center mb-4`}>
                    <Icon className={`w-6 h-6 ${value.color}`} />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{value.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {value.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-20 px-4 border-b">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">Our Journey</h2>
          <div className="space-y-8">
            {milestones.map((milestone, index) => (
              <div key={index} className="flex gap-6">
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center font-bold text-primary text-sm">
                    {index + 1}
                  </div>
                  {index !== milestones.length - 1 && (
                    <div className="w-0.5 h-full bg-border mt-2" />
                  )}
                </div>
                <div className="pb-12">
                  <div className="text-sm font-semibold text-primary mb-1">{milestone.year}</div>
                  <h3 className="text-xl font-bold mb-2">{milestone.title}</h3>
                  <p className="text-muted-foreground">{milestone.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why We&apos;re Different */}
      <section className="py-20 px-4 border-b bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-center">Why We&apos;re Different</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
            <div className="bg-background p-6 rounded-lg border">
              <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                <span className="text-red-500">❌</span> Other Platforms
              </h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>• Weeks to get started</li>
                <li>• Black box training process</li>
                <li>• Manual testing and deployment</li>
                <li>• Complex pricing and surprise bills</li>
                <li>• Support tickets take days</li>
                <li>• Documentation written for PhDs</li>
              </ul>
            </div>
            <div className="bg-background p-6 rounded-lg border">
              <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                <span className="text-green-500">✓</span> Fine-Tune Lab
              </h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>• Train your first model in 2 minutes</li>
                <li>• Real-time WebSocket metrics</li>
                <li>• One-click testing and deployment</li>
                <li>• Pay-as-you-go, no surprises</li>
                <li>• Discord/email support responds in hours</li>
                <li>• Docs optimized for LLM assistants</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Team Culture */}
      <section className="py-20 px-4 border-b">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Built by Developers, for Everyone</h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            We&apos;re a small, focused team obsessed with developer experience. Every feature goes through the &quot;would I use this?&quot; test.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <div className="p-6 border rounded-lg bg-muted/30">
              <div className="text-4xl mb-3">🚀</div>
              <h3 className="font-bold mb-2">Ship Fast</h3>
              <p className="text-sm text-muted-foreground">New features every week based on user feedback</p>
            </div>
            <div className="p-6 border rounded-lg bg-muted/30">
              <div className="text-4xl mb-3">🤝</div>
              <h3 className="font-bold mb-2">Community Driven</h3>
              <p className="text-sm text-muted-foreground">Your feature requests shape our roadmap</p>
            </div>
            <div className="p-6 border rounded-lg bg-muted/30">
              <div className="text-4xl mb-3">💬</div>
              <h3 className="font-bold mb-2">Always Available</h3>
              <p className="text-sm text-muted-foreground">Discord, email, or in-app chat support</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Join Thousands of Developers</h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Start training production-ready models today. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login" className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 h-11 rounded-md px-8">
              Get Started Free
            </Link>
            <Link href="/contact" className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer border border-input bg-background hover:bg-accent hover:text-accent-foreground h-11 rounded-md px-8">
              Talk to Our Team
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
            '@type': 'Organization',
            name: 'Fine-Tune Lab',
            description: 'Enterprise-grade LLM fine-tuning platform making AI model training accessible to developers, startups, and enterprises.',
            url: 'https://finetunelab.ai',
            logo: 'https://finetunelab.ai/logo.png',
            foundingDate: '2024',
            founders: [
              {
                '@type': 'Organization',
                name: 'Fine-Tune Lab Team'
              }
            ],
            sameAs: [
              'https://github.com/finetunelab',
              'https://twitter.com/finetunelab',
              'https://linkedin.com/company/finetunelab'
            ],
            contactPoint: {
              '@type': 'ContactPoint',
              contactType: 'Customer Support',
              email: 'support@finetunelab.ai'
            },
            areaServed: {
              '@type': 'Place',
              name: 'Worldwide'
            },
            numberOfEmployees: {
              '@type': 'QuantitativeValue',
              value: 10
            }
          })
        }}
      />
    </div>
  )
}
