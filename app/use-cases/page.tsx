import type { Metadata } from 'next'
import { MessageSquare, Code, FileText, TrendingUp, Users, ShoppingCart, Brain, Briefcase, CheckCircle, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Real-World LLM Fine-Tuning Use Cases & Examples | FineTune Lab - Customer Support AI, Code Generation, Document Analysis',
  description: 'Real examples of fine-tuning LLMs: 80% ticket deflection with customer support AI chatbots, 40% faster development with code generation, 98% accuracy document extraction, content generation at scale, sentiment analysis, sales automation, e-commerce recommendations. Complete training data examples and results.',
  keywords: [
    'LLM fine-tuning use cases',
    'customer support AI automation',
    'AI chatbot training examples',
    'support ticket deflection',
    'automated customer service bot',
    'code generation AI assistant',
    'GitHub code fine-tuning',
    'automated test generation',
    'code review AI',
    'document analysis extraction',
    'invoice data extraction AI',
    'contract analysis automation',
    'legal document classifier',
    'medical record AI',
    'content generation at scale',
    'product description generator',
    'marketing copy AI',
    'email campaign automation',
    'sentiment analysis model',
    'review sentiment classification',
    'intent detection NLP',
    'sales lead qualification AI',
    'personalized outreach automation',
    'deal risk prediction',
    'e-commerce recommendation AI',
    'shopping assistant chatbot',
    'domain-specific AI training',
    'legal AI assistant',
    'medical AI model training',
    'financial AI chatbot',
    'training data examples JSONL',
    'fine-tuning tutorial guide'
  ],
  openGraph: {
    title: 'LLM Fine-Tuning Use Cases | FineTune Lab',
    description: 'Real-world use cases for fine-tuning LLMs: customer support automation, code generation, document analysis, and more.',
    type: 'website',
    url: 'https://app.finetunelab.ai/use-cases',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LLM Fine-Tuning Use Cases | FineTune Lab',
    description: 'Real-world use cases for fine-tuning LLMs: customer support automation, code generation, document analysis, and more.',
  },
}

export default function UseCasesPage() {
  return (
    <>
      {/* JSON-LD Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'LLM Fine-Tuning Use Cases',
            description: 'Real-world applications and use cases for fine-tuning large language models with FineTune Lab.',
            provider: {
              '@type': 'Organization',
              name: 'FineTune Lab',
            },
          }),
        }}
      />

      <div className="min-h-screen bg-background">
        {/* Hero Section */}
        <section className="border-b bg-gradient-to-b from-background to-muted/20">
          <div className="max-w-6xl mx-auto px-4 py-20">
            <div className="text-center max-w-3xl mx-auto">
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
                Real-World Use Cases
                <span className="block mt-2 bg-gradient-to-r from-purple-600 to-orange-500 bg-clip-text text-transparent">
                  For Fine-Tuned LLMs
                </span>
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                See how companies are training custom AI models to solve specific business problems. From customer support to code generation, discover what's possible with fine-tuning.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/welcome" className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 h-11 rounded-md px-8">
                  Start Your First Model
                </Link>
                <Link href="/features" className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer border border-input bg-background hover:bg-accent hover:text-accent-foreground h-11 rounded-md px-8">
                  View Features
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Main Use Cases */}
        <section className="py-20">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold mb-4">Popular Use Cases</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Real examples from companies using FineTune Lab to train production AI models
              </p>
            </div>

            {/* Use Case 1: Customer Support */}
            <div className="mb-20">
              <div className="bg-card border rounded-xl p-8 md:p-12">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">Customer Support Automation</h3>
                    <p className="text-muted-foreground">Train AI that answers customer questions in your brand voice</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-blue-500" />
                      What You Can Build
                    </h4>
                    <ul className="space-y-2 text-muted-foreground">
                      <li>• AI chatbot that answers product questions accurately</li>
                      <li>• Support ticket classifier routing to right team</li>
                      <li>• Automated response suggester for agents</li>
                      <li>• FAQ bot with grounded, citation-backed answers</li>
                      <li>• Multi-language support with translation</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-blue-500" />
                      Training Data Examples
                    </h4>
                    <ul className="space-y-2 text-muted-foreground">
                      <li>• Historical support tickets with resolutions</li>
                      <li>• Product documentation and knowledge base</li>
                      <li>• Chat transcripts from successful conversations</li>
                      <li>• FAQ pairs with approved answers</li>
                      <li>• Escalation patterns and edge cases</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-8 p-6 bg-muted/50 rounded-lg border">
                  <div className="flex items-start gap-4">
                    <div className="w-2 h-full bg-blue-500 rounded" />
                    <div className="flex-1">
                      <p className="font-semibold mb-2">Real Example</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        SaaS company with 50,000 monthly tickets. Fine-tuned Llama 3.3 on 2 years of historical tickets + product docs. Result: <strong>80% ticket deflection rate</strong>, 3-second average response time, 4.8/5 customer satisfaction.
                      </p>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="p-3 bg-background rounded">
                          <div className="text-2xl font-bold text-blue-500">80%</div>
                          <div className="text-xs text-muted-foreground">Ticket Deflection</div>
                        </div>
                        <div className="p-3 bg-background rounded">
                          <div className="text-2xl font-bold text-blue-500">3s</div>
                          <div className="text-xs text-muted-foreground">Response Time</div>
                        </div>
                        <div className="p-3 bg-background rounded">
                          <div className="text-2xl font-bold text-blue-500">4.8/5</div>
                          <div className="text-xs text-muted-foreground">Satisfaction</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Use Case 2: Code Generation */}
            <div className="mb-20">
              <div className="bg-card border rounded-xl p-8 md:p-12">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                    <Code className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">Code Generation & Documentation</h3>
                    <p className="text-muted-foreground">Train AI that understands your codebase conventions</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-purple-500" />
                      What You Can Build
                    </h4>
                    <ul className="space-y-2 text-muted-foreground">
                      <li>• Code generator following team style guides</li>
                      <li>• Automated test case writer</li>
                      <li>• API documentation generator from code</li>
                      <li>• Code review assistant with team standards</li>
                      <li>• Bug fix suggester based on historical fixes</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-purple-500" />
                      Training Data Examples
                    </h4>
                    <ul className="space-y-2 text-muted-foreground">
                      <li>• GitHub repos with commit history</li>
                      <li>• Pull request comments and code reviews</li>
                      <li>• Internal style guides and conventions</li>
                      <li>• Test suites with edge cases</li>
                      <li>• Bug reports paired with fixes</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-8 p-6 bg-muted/50 rounded-lg border">
                  <div className="flex items-start gap-4">
                    <div className="w-2 h-full bg-purple-500 rounded" />
                    <div className="flex-1">
                      <p className="font-semibold mb-2">Real Example</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Engineering team at fintech company. Fine-tuned on 3 years of internal React/TypeScript repos. Result: Generates boilerplate components, hooks, and tests matching team conventions. <strong>40% faster feature development</strong>, consistent code quality.
                      </p>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="p-3 bg-background rounded">
                          <div className="text-2xl font-bold text-purple-500">40%</div>
                          <div className="text-xs text-muted-foreground">Faster Dev</div>
                        </div>
                        <div className="p-3 bg-background rounded">
                          <div className="text-2xl font-bold text-purple-500">95%</div>
                          <div className="text-xs text-muted-foreground">Style Match</div>
                        </div>
                        <div className="p-3 bg-background rounded">
                          <div className="text-2xl font-bold text-purple-500">100%</div>
                          <div className="text-xs text-muted-foreground">Test Coverage</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Use Case 3: Document Analysis */}
            <div className="mb-20">
              <div className="bg-card border rounded-xl p-8 md:p-12">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">Document Analysis & Extraction</h3>
                    <p className="text-muted-foreground">Extract structured data from unstructured documents</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      What You Can Build
                    </h4>
                    <ul className="space-y-2 text-muted-foreground">
                      <li>• Invoice/receipt data extractor</li>
                      <li>• Contract clause analyzer and summarizer</li>
                      <li>• Medical record information retrieval</li>
                      <li>• Legal document classifier</li>
                      <li>• Research paper Q&A with citations</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      Training Data Examples
                    </h4>
                    <ul className="space-y-2 text-muted-foreground">
                      <li>• Annotated invoices with extracted fields</li>
                      <li>• Contracts with clause classifications</li>
                      <li>• Medical records with entity labels</li>
                      <li>• Legal briefs with issue tags</li>
                      <li>• Research papers with Q&A pairs</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-8 p-6 bg-muted/50 rounded-lg border">
                  <div className="flex items-start gap-4">
                    <div className="w-2 h-full bg-green-500 rounded" />
                    <div className="flex-1">
                      <p className="font-semibold mb-2">Real Example</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Legal tech startup processing 1,000+ contracts daily. Fine-tuned on 50,000 annotated contracts. Result: Extracts key terms, dates, parties, obligations with <strong>98% accuracy</strong>. Reduced manual review time from 30 minutes to 2 minutes per contract.
                      </p>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="p-3 bg-background rounded">
                          <div className="text-2xl font-bold text-green-500">98%</div>
                          <div className="text-xs text-muted-foreground">Accuracy</div>
                        </div>
                        <div className="p-3 bg-background rounded">
                          <div className="text-2xl font-bold text-green-500">93%</div>
                          <div className="text-xs text-muted-foreground">Time Saved</div>
                        </div>
                        <div className="p-3 bg-background rounded">
                          <div className="text-2xl font-bold text-green-500">15x</div>
                          <div className="text-xs text-muted-foreground">Faster Review</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Use Case Grid: Additional Use Cases */}
            <div className="grid md:grid-cols-2 gap-8 mb-20">
              {/* Content Generation */}
              <div className="bg-card border rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-xl font-bold">Content Generation</h3>
                </div>
                <p className="text-muted-foreground mb-4">
                  Generate marketing copy, product descriptions, social media posts in your brand voice.
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-orange-500 mt-0.5" />
                    <span>Product descriptions at scale</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-orange-500 mt-0.5" />
                    <span>Email campaign copy generation</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-orange-500 mt-0.5" />
                    <span>Social media posts with brand tone</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-orange-500 mt-0.5" />
                    <span>Blog article outlines and drafts</span>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-muted rounded text-sm">
                  <strong>Example:</strong> E-commerce brand trained on 10,000 past product descriptions. Generates SEO-optimized descriptions in seconds.
                </div>
              </div>

              {/* Sentiment & Classification */}
              <div className="bg-card border rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center">
                    <Brain className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-xl font-bold">Sentiment & Classification</h3>
                </div>
                <p className="text-muted-foreground mb-4">
                  Classify text, detect sentiment, analyze customer feedback with domain-specific understanding.
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-pink-500 mt-0.5" />
                    <span>Review sentiment (positive/negative/neutral)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-pink-500 mt-0.5" />
                    <span>Support ticket urgency classifier</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-pink-500 mt-0.5" />
                    <span>Content moderation and safety</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-pink-500 mt-0.5" />
                    <span>Intent detection from messages</span>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-muted rounded text-sm">
                  <strong>Example:</strong> Social media platform fine-tuned for detecting nuanced toxicity. 95% accuracy vs 70% with generic models.
                </div>
              </div>

              {/* Sales & Lead Qualification */}
              <div className="bg-card border rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-xl font-bold">Sales & Lead Qualification</h3>
                </div>
                <p className="text-muted-foreground mb-4">
                  Automate lead scoring, qualification, and initial outreach with personalized messaging.
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-cyan-500 mt-0.5" />
                    <span>Lead quality scorer from signals</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-cyan-500 mt-0.5" />
                    <span>Personalized email outreach generator</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-cyan-500 mt-0.5" />
                    <span>Meeting notes summarizer</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-cyan-500 mt-0.5" />
                    <span>Deal risk predictor</span>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-muted rounded text-sm">
                  <strong>Example:</strong> B2B SaaS trained on 5 years of CRM data. Predicts deal close probability with 85% accuracy.
                </div>
              </div>

              {/* E-commerce & Product */}
              <div className="bg-card border rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center">
                    <ShoppingCart className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-xl font-bold">E-commerce & Recommendations</h3>
                </div>
                <p className="text-muted-foreground mb-4">
                  Product recommendations, search, and conversational shopping assistants trained on your catalog.
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-yellow-500 mt-0.5" />
                    <span>Shopping assistant with product knowledge</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-yellow-500 mt-0.5" />
                    <span>Size/fit recommendation from reviews</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-yellow-500 mt-0.5" />
                    <span>Product comparison generator</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-yellow-500 mt-0.5" />
                    <span>Return reason classifier</span>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-muted rounded text-sm">
                  <strong>Example:</strong> Fashion retailer trained on 1M+ customer interactions. Increased conversion by 25% with better recommendations.
                </div>
              </div>
            </div>

            {/* Domain-Specific Expertise */}
            <div className="mb-20">
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border rounded-xl p-8 md:p-12">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
                    <Briefcase className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">Domain-Specific Expertise</h3>
                    <p className="text-muted-foreground">Train models with specialized knowledge for regulated industries</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  <div className="bg-card border rounded-lg p-6">
                    <h4 className="font-semibold mb-3">Legal AI</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• Case law research assistant</li>
                      <li>• Contract review and redlining</li>
                      <li>• Legal document drafting</li>
                      <li>• Regulatory compliance checker</li>
                    </ul>
                  </div>

                  <div className="bg-card border rounded-lg p-6">
                    <h4 className="font-semibold mb-3">Medical AI</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• Clinical question answering</li>
                      <li>• Medical literature search</li>
                      <li>• Patient intake summarization</li>
                      <li>• ICD-10 code suggester</li>
                    </ul>
                  </div>

                  <div className="bg-card border rounded-lg p-6">
                    <h4 className="font-semibold mb-3">Financial AI</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• Financial report analysis</li>
                      <li>• Investment research assistant</li>
                      <li>• Risk assessment automation</li>
                      <li>• Fraud detection classifier</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-white dark:bg-slate-900 border rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <strong>Note:</strong> Domain-specific models require high-quality training data and rigorous evaluation. FineTune Lab's LLM-as-a-Judge and batch testing features help validate accuracy before production deployment.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How to Get Started */}
        <section className="py-20 bg-muted/20 border-y">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold mb-4">How to Get Started</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Turn your use case into a production model in 4 simple steps
              </p>
            </div>

            <div className="grid md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-purple-500 text-white flex items-center justify-center text-2xl font-bold mx-auto mb-4">1</div>
                <h3 className="font-semibold mb-2">Collect Data</h3>
                <p className="text-sm text-muted-foreground">
                  Gather historical examples: support tickets, code samples, documents, or conversations.
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-blue-500 text-white flex items-center justify-center text-2xl font-bold mx-auto mb-4">2</div>
                <h3 className="font-semibold mb-2">Format & Upload</h3>
                <p className="text-sm text-muted-foreground">
                  Convert to JSONL format with input/output pairs. Upload to FineTune Lab.
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-green-500 text-white flex items-center justify-center text-2xl font-bold mx-auto mb-4">3</div>
                <h3 className="font-semibold mb-2">Train & Monitor</h3>
                <p className="text-sm text-muted-foreground">
                  Select base model, configure training. Watch real-time metrics as model learns.
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-orange-500 text-white flex items-center justify-center text-2xl font-bold mx-auto mb-4">4</div>
                <h3 className="font-semibold mb-2">Test & Deploy</h3>
                <p className="text-sm text-muted-foreground">
                  Evaluate with batch tests, deploy to production, monitor quality metrics.
                </p>
              </div>
            </div>

            <div className="text-center mt-12">
              <Link href="/welcome" className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 h-11 rounded-md px-8">
                Start Training Your Model
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-20">
          <div className="max-w-4xl mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold mb-4">Frequently Asked Questions</h2>
              <p className="text-xl text-muted-foreground">
                Common questions about use cases and training data
              </p>
            </div>

            <div className="space-y-6">
              <details className="bg-card border rounded-lg p-6 group">
                <summary className="font-semibold cursor-pointer list-none flex items-center justify-between">
                  How much training data do I need?
                  <span className="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-4 text-muted-foreground">
                  For most use cases, 100-1,000 high-quality examples is a good starting point. Customer support and classification tasks can work with 100-500 examples. Code generation and document analysis benefit from 1,000-10,000 examples. Quality matters more than quantity - clean, representative data beats large noisy datasets.
                </p>
              </details>

              <details className="bg-card border rounded-lg p-6 group">
                <summary className="font-semibold cursor-pointer list-none flex items-center justify-between">
                  Can I fine-tune for multiple use cases at once?
                  <span className="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-4 text-muted-foreground">
                  Yes, you can train a single model on mixed data (e.g., support tickets + product questions + documentation). However, for best results, consider training separate models for distinct use cases and using a router to send queries to the right model. This maintains specialized performance.
                </p>
              </details>

              <details className="bg-card border rounded-lg p-6 group">
                <summary className="font-semibold cursor-pointer list-none flex items-center justify-between">
                  What base model should I choose for my use case?
                  <span className="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-4 text-muted-foreground">
                  For most use cases, start with Llama 3.3 or Mistral - they offer the best balance of quality and speed. For code generation, consider models pre-trained on code. For domain-specific tasks (legal, medical), look for specialized base models if available. Run batch tests to compare performance before committing.
                </p>
              </details>

              <details className="bg-card border rounded-lg p-6 group">
                <summary className="font-semibold cursor-pointer list-none flex items-center justify-between">
                  How do I validate my model works for my use case?
                  <span className="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-4 text-muted-foreground">
                  Use FineTune Lab's batch testing to run your model on held-out test data. Enable LLM-as-a-Judge for automated scoring on accuracy, helpfulness, and safety. Test with real edge cases and failure modes. Compare predictions from different checkpoints side-by-side. Monitor Model Observability metrics in production.
                </p>
              </details>

              <details className="bg-card border rounded-lg p-6 group">
                <summary className="font-semibold cursor-pointer list-none flex items-center justify-between">
                  Can I update my model as I get more data?
                  <span className="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-4 text-muted-foreground">
                  Yes. As you collect new examples (customer conversations, support tickets, etc.), combine them with your original training data and retrain. FineTune Lab's Training Analytics lets you compare new versions against previous ones to ensure improvement. Versioning helps track which training data produced the best results.
                </p>
              </details>

              <details className="bg-card border rounded-lg p-6 group">
                <summary className="font-semibold cursor-pointer list-none flex items-center justify-between">
                  What if my use case isn't listed here?
                  <span className="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-4 text-muted-foreground">
                  These are common patterns, but fine-tuning works for many more use cases. The key is having input/output pairs showing the behavior you want. If you can demonstrate it with examples, you can fine-tune for it. Contact our team to discuss your specific use case and get guidance on training data requirements.
                </p>
              </details>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 border-t">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to Build Your Use Case?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Start with our free tier. Train your first model in under 2 minutes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/welcome" className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 h-11 rounded-md px-8">
                Get Started Free
              </Link>
              <Link href="/contact" className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer border border-input bg-background hover:bg-accent hover:text-accent-foreground h-11 rounded-md px-8">
                Talk to Our Team
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
