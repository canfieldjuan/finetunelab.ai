import type { Metadata } from 'next'
import { BarChart3, MessageSquare, TrendingUp, Zap, Clock, Target, CheckCircle, Database } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Complete LLM Fine-Tuning Platform | FineTune Lab - Train, Monitor, Test, Deploy AI Models in Under 2 Minutes',
  description: 'Fine-tune Llama 3.3, Mistral, Qwen models with LoRA/QLoRA, DPO, RLHF. Real-time WebSocket training metrics, GPU memory monitoring, GraphRAG context testing, automated LLM-as-judge evaluation. Deploy to RunPod Serverless with one click. Export analytics as CSV/JSON/PDF.',
  keywords: [
    'LLM fine-tuning platform',
    'AI model training platform',
    'Llama 3.3 fine-tuning',
    'Mistral fine-tuning',
    'Qwen model training',
    'LoRA training tutorial',
    'QLoRA 4-bit quantization',
    'DPO direct preference optimization',
    'RLHF reinforcement learning',
    'supervised fine-tuning SFT',
    'real-time training analytics',
    'WebSocket training metrics',
    'GPU memory monitoring',
    'VRAM utilization tracking',
    'model chat testing platform',
    'GraphRAG document knowledge graph',
    'prediction tracking epochs',
    'LLM-as-a-judge evaluation',
    'GPT-4 Claude judge models',
    'training loss curves visualization',
    'checkpoint management system',
    '4-bit 8-bit quantization',
    'RunPod cloud GPU training',
    'A4000 A5000 H100 training',
    'model deployment automation',
    'RunPod Serverless deployment',
    'vLLM production deployment',
    'batch model testing',
    'model observability dashboard',
    'training cost tracking',
    'gradient checkpointing',
    'early stopping patience',
    'overfitting detection',
    'anomaly detection training',
    'multi-format analytics export'
  ],
  openGraph: {
    title: 'LLM Fine-Tuning Platform | FineTune Lab',
    description: 'Fine-tune Llama, Mistral, Qwen models in under 2 minutes with real-time analytics, testing, and deployment.',
    type: 'website',
    url: 'https://app.finetunelab.ai/features',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LLM Fine-Tuning Platform | FineTune Lab',
    description: 'Fine-tune Llama, Mistral, Qwen models in under 2 minutes with real-time analytics, testing, and deployment.',
  },
}

export default function FeaturesPage() {
  return (
    <>
      {/* JSON-LD Schema for AI Search */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'FineTune Lab',
            applicationCategory: 'DeveloperApplication',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'USD',
            },
            featureList: [
              'Fine-tune Llama 3.3, Mistral, Qwen with LoRA or full training',
              'Supervised fine-tuning (SFT), DPO, ORPO, and RLHF methods',
              '4-bit and 8-bit quantization with up to 75% memory savings',
              'Real-time training analytics with live loss curves and GPU monitoring',
              'RunPod cloud training on A4000 to H100 GPUs',
              'Chat testing with GraphRAG context and document knowledge graphs',
              'Prediction tracking across training checkpoints with confidence scores',
              'LLM-as-a-judge automated evaluation at scale',
              'Checkpoint management with automatic best-model selection',
              'One-click deployment to production with auto-scaling',
              'Cost tracking with budget limits and real-time spending',
              'Multi-format analytics export (CSV, JSON, PDF)'
            ],
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: '4.8',
              ratingCount: '127',
            },
          }),
        }}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: 'What models can I fine-tune with FineTune Lab?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'FineTune Lab supports fine-tuning Llama 3.3, 3.1, 2, Mistral, Qwen, and other popular open-source models. You can use LoRA (Low-Rank Adaptation) for efficient training or full fine-tuning for maximum customization. Training methods include SFT (Supervised Fine-Tuning), DPO, ORPO, and RLHF.',
                },
              },
              {
                '@type': 'Question',
                name: 'How does 4-bit quantization reduce training costs?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Quantization reduces model memory requirements by up to 75% without significant quality loss. This allows training larger models or using bigger batch sizes on the same GPU. FineTune Lab displays approximate VRAM savings and monitors validation metrics in real-time to ensure quantization doesn\'t hurt performance.',
                },
              },
              {
                '@type': 'Question',
                name: 'How does real-time training analytics work in FineTune Lab?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Training metrics use WebSocket streaming to push updates instantly to your browser. Loss curves, GPU utilization, memory usage, and throughput metrics update in real-time as each batch completes. Monitor training and validation loss simultaneously to catch overfitting the moment it occurs.',
                },
              },
              {
                '@type': 'Question',
                name: 'What is GraphRAG and how does it improve chat testing?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'GraphRAG uses knowledge graphs to provide grounded, citation-backed responses during model testing. Upload PDFs, TXT, or MD documents to create a knowledge graph with semantic embeddings and relationships. The chat interface displays which document sources the model used, helping you understand response accuracy and context usage.',
                },
              },
              {
                '@type': 'Question',
                name: 'Can I track model predictions during training?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes. Configure predictions to generate during training at eval steps, epochs, or specific intervals. View sample outputs in the Training Predictions card showing prompt, ground truth, and model response. The Prediction Evolution view tracks how answers improve across epochs, providing concrete evidence of learning beyond loss numbers.',
                },
              },
              {
                '@type': 'Question',
                name: 'How does LLM-as-a-Judge evaluation work?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'LLM-as-a-Judge uses models like GPT-4, Claude, or custom fine-tuned models to automate response scoring at scale. During batch testing, enable the LLM-as-judge checkbox to receive numerical scores and explanations for each response. The judge evaluates on criteria like accuracy, clarity, and completeness with human-readable reasoning.',
                },
              },
              {
                '@type': 'Question',
                name: 'What analytics can I export from FineTune Lab?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Export analytics in three formats: CSV (opens in Excel/Google Sheets with labeled columns), JSON (structured for data pipelines and warehouses), and PDF (report-ready charts and tables). Exports include training metrics, evaluation results, response times, cost tracking, sentiment trends, and model comparison data.',
                },
              },
              {
                '@type': 'Question',
                name: 'How does checkpoint management help select the best model?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Checkpoint management uses multi-metric scoring combining eval loss, overfitting penalty (train/eval gap), perplexity, and improvement rate. The system highlights the best checkpoint automatically rather than selecting lowest raw loss. View all checkpoints by timestamp, step, and key metrics, then compare or mark preferred checkpoints for deployment.',
                },
              },
            ],
          }),
        }}
      />

      <div className="min-h-screen bg-background">
        {/* Hero Section */}
        <section className="border-b bg-gradient-to-b from-background to-muted/20">
          <div className="max-w-6xl mx-auto px-4 py-20">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
                Fine-Tune Any LLM
                <span className="block mt-2 bg-gradient-to-r from-purple-600 to-orange-500 bg-clip-text text-transparent">
                  In Under 2 Minutes
                </span>
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                Train Llama, Mistral, Qwen models on your data. Monitor with real-time analytics. Test with GraphRAG. Deploy to production with one click.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/welcome" className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 h-11 rounded-md px-8">
                  Start Training Free
                </Link>
                <Link href="/docs" className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer border border-input bg-background hover:bg-accent hover:text-accent-foreground h-11 rounded-md px-8">
                  View Documentation
                </Link>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <div className="bg-card border rounded-lg p-6 text-center">
                <Clock className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                <div className="text-3xl font-bold mb-1">Under 2min</div>
                <div className="text-sm text-muted-foreground">From dataset to deployed model</div>
              </div>
              <div className="bg-card border rounded-lg p-6 text-center">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <div className="text-3xl font-bold mb-1">Real-time</div>
                <div className="text-sm text-muted-foreground">WebSocket-streamed metrics</div>
              </div>
              <div className="bg-card border rounded-lg p-6 text-center">
                <Target className="w-8 h-8 mx-auto mb-2 text-orange-500" />
                <div className="text-3xl font-bold mb-1">3 Formats</div>
                <div className="text-sm text-muted-foreground">CSV, JSON, PDF exports</div>
              </div>
            </div>
          </div>
        </section>

        {/* Main Features */}
        <section className="py-20">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold mb-4">Complete AI Training Platform</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Fine-tuning, analytics, testing, and predictions - everything you need to train production AI models.
              </p>
            </div>

            {/* Feature 0: Training & Fine-Tuning */}
            <div className="mb-20">
              <div className="bg-card border rounded-xl p-8 md:p-12">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">LLM Fine-Tuning Made Simple</h3>
                    <p className="text-muted-foreground">Train custom models on your data in under 2 minutes</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      Supported Models & Methods
                    </h4>
                    <ul className="space-y-2 text-muted-foreground">
                      <li>• Llama 3.3, 3.1, 2, Mistral, Qwen, and more base models</li>
                      <li>• LoRA (Low-Rank Adaptation) and full fine-tuning</li>
                      <li>• SFT (Supervised Fine-Tuning), DPO, ORPO, RLHF methods</li>
                      <li>• Mixed precision training: FP16, BF16, FP32</li>
                      <li>• 4-bit and 8-bit quantization (up to 75% memory savings)</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      Dataset Management
                    </h4>
                    <ul className="space-y-2 text-muted-foreground">
                      <li>• JSONL format validation with quality checks</li>
                      <li>• Automatic dataset splitting (train/validation)</li>
                      <li>• Dataset versioning and stats</li>
                      <li>• Support for custom max_length and sequence truncation</li>
                      <li>• Padding and tokenization handled automatically</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      Training Configuration
                    </h4>
                    <ul className="space-y-2 text-muted-foreground">
                      <li>• Automatic hyperparameter optimization</li>
                      <li>• Configurable epochs, batch size, learning rate</li>
                      <li>• Gradient accumulation and checkpointing</li>
                      <li>• Early stopping with configurable patience</li>
                      <li>• Logging steps config based on dataset size</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      Cloud Training
                    </h4>
                    <ul className="space-y-2 text-muted-foreground">
                      <li>• RunPod GPU cloud: A4000, A5000, A6000, H100</li>
                      <li>• Budget limits with auto-stop when limit reached</li>
                      <li>• Resume training from saved checkpoints</li>
                      <li>• Multi-GPU training support</li>
                      <li>• Automatic checkpoint saves and recovery</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-8 p-4 bg-muted/50 rounded-lg border-l-4 border-green-500">
                  <p className="text-sm font-medium mb-2">💡 Use Case</p>
                  <p className="text-sm text-muted-foreground">
                    Upload your customer support conversations in JSONL format, select Llama 3.3 as the base model, enable 4-bit quantization to reduce memory, and click train. In under 2 minutes, you&apos;ll have a custom model that understands your product and responds like your best support agent.
                  </p>
                </div>
              </div>
            </div>

            {/* Feature 1: Analytics */}
            <div className="mb-20">
              <div className="bg-card border rounded-xl p-8 md:p-12">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">Real-Time Training Analytics</h3>
                    <p className="text-muted-foreground">Monitor every aspect of your training in real-time</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      Live Monitoring
                    </h4>
                    <ul className="space-y-2 text-muted-foreground">
                      <li>• WebSocket-streamed loss curves updating with every batch</li>
                      <li>• GPU utilization, memory usage, and temperature tracking</li>
                      <li>• Training and validation loss on the same chart</li>
                      <li>• Real-time overfitting detection when losses diverge</li>
                      <li>• Throughput metrics: tokens/sec and samples/sec</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      Analytics & Exports
                    </h4>
                    <ul className="space-y-2 text-muted-foreground">
                      <li>• Export in CSV, JSON, or PDF formats</li>
                      <li>• Compare up to 5 training runs side-by-side</li>
                      <li>• Date range filtering and custom time periods</li>
                      <li>• Cost tracking with budget limits and spending alerts</li>
                      <li>• Perplexity tracking alongside loss metrics</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      Model Comparison
                    </h4>
                    <ul className="space-y-2 text-muted-foreground">
                      <li>• Side-by-side metric tables with sorting and filtering</li>
                      <li>• Color-coded loss curves (solid for train, dashed for eval)</li>
                      <li>• Training effectiveness: compare DPO, ORPO, RLHF vs baseline</li>
                      <li>• Trend indicators showing improvement or regression</li>
                      <li>• Best checkpoint score combining multiple signals</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      Advanced Features
                    </h4>
                    <ul className="space-y-2 text-muted-foreground">
                      <li>• Gradient norm tracking to catch exploding gradients</li>
                      <li>• A/B testing with statistical confidence intervals</li>
                      <li>• Natural language analytics: ask questions in plain English</li>
                      <li>• Anomaly detection flagging unusual metric patterns</li>
                      <li>• Quality forecasting: predict metric trends before issues occur</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-8 p-4 bg-muted/50 rounded-lg border-l-4 border-purple-500">
                  <p className="text-sm font-medium mb-2">💡 Use Case</p>
                  <p className="text-sm text-muted-foreground">
                    Monitor training progress live in the Training Monitor page. See loss curves update with every batch, catch overfitting immediately when validation loss plateaus, and stop training the moment metrics stop improving - all without waiting hours to discover issues.
                  </p>
                </div>
              </div>
            </div>

            {/* Feature 2: Chat Testing */}
            <div className="mb-20">
              <div className="bg-card border rounded-xl p-8 md:p-12">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">Intelligent Chat Testing</h3>
                    <p className="text-muted-foreground">Test models with GraphRAG and context-aware evaluation</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-blue-500" />
                      GraphRAG Knowledge
                    </h4>
                    <ul className="space-y-2 text-muted-foreground">
                      <li>• Upload PDFs, TXT, MD documents to knowledge graph</li>
                      <li>• Neo4j integration with Cypher queries</li>
                      <li>• Custom node types and relationships</li>
                      <li>• Semantic embeddings with multi-hop traversal</li>
                      <li>• Context display showing which sources model used</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-blue-500" />
                      Evaluation Tools
                    </h4>
                    <ul className="space-y-2 text-muted-foreground">
                      <li>• Quick feedback: thumbs up/down and star ratings</li>
                      <li>• Detailed evaluation with groundedness scoring</li>
                      <li>• Custom evaluation tags (hallucination, off-topic, etc.)</li>
                      <li>• Success/Fail marking with notes and expected behavior</li>
                      <li>• All evaluations auto-saved to database</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-blue-500" />
                      Batch Testing
                    </h4>
                    <ul className="space-y-2 text-muted-foreground">
                      <li>• Upload validation sets with expected answers</li>
                      <li>• Run automated prompts across multiple models</li>
                      <li>• JSON schema validation for structured outputs</li>
                      <li>• Custom Python scoring functions</li>
                      <li>• Results with reference answer comparison</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-blue-500" />
                      Model Observability
                    </h4>
                    <ul className="space-y-2 text-muted-foreground">
                      <li>• Response time trends: P50, P95, P99 percentiles</li>
                      <li>• SLA breach rate tracking ({'>'}200ms threshold)</li>
                      <li>• Token usage analytics: input vs output breakdown</li>
                      <li>• Sentiment analysis: positive, neutral, negative trends</li>
                      <li>• Session tagging for A/B test comparison</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-8 p-4 bg-muted/50 rounded-lg border-l-4 border-blue-500">
                  <p className="text-sm font-medium mb-2">💡 Use Case</p>
                  <p className="text-sm text-muted-foreground">
                    Upload your product documentation to GraphRAG, then test if your fine-tuned model can answer customer questions with grounded citations. The chat interface shows which document chunks were used, helping validate that your model leverages context instead of hallucinating answers.
                  </p>
                </div>
              </div>
            </div>

            {/* Feature 3: Predictions */}
            <div>
              <div className="bg-card border rounded-xl p-8 md:p-12">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">Prediction Tracking & Validation</h3>
                    <p className="text-muted-foreground">Monitor learning progress and automate evaluation at scale</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-orange-500" />
                      Training Predictions
                    </h4>
                    <ul className="space-y-2 text-muted-foreground">
                      <li>• Generate predictions during eval, epochs, or every X steps</li>
                      <li>• Configure 1-100 predictions per checkpoint</li>
                      <li>• View prompt, ground truth, and model response</li>
                      <li>• Prediction Evolution tracks improvement over epochs</li>
                      <li>• Concrete evidence of learning beyond loss numbers</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-orange-500" />
                      LLM-as-a-Judge
                    </h4>
                    <ul className="space-y-2 text-muted-foreground">
                      <li>• GPT-4, Claude, or custom fine-tuned judge models</li>
                      <li>• Scores responses on 5 criteria: Helpful, Accurate, Clear, Safe, Complete</li>
                      <li>• Human-readable explanations with numerical scores</li>
                      <li>• Run on historical predictions retroactively</li>
                      <li>• Scale evaluation without manual review</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-orange-500" />
                      Multi-Axis Rating
                    </h4>
                    <ul className="space-y-2 text-muted-foreground">
                      <li>• Score clarity, accuracy, conciseness, quality separately</li>
                      <li>• Aggregate scores into averages and distributions</li>
                      <li>• Identify specific weaknesses: accurate but not concise</li>
                      <li>• Groundedness scoring for RAG context usage</li>
                      <li>• Confidence scores and token probabilities</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-orange-500" />
                      Checkpoint Selection
                    </h4>
                    <ul className="space-y-2 text-muted-foreground">
                      <li>• Multi-metric scoring: eval loss + overfitting penalty + perplexity</li>
                      <li>• Best checkpoint highlighted with improvement indicators</li>
                      <li>• Compare predictions across checkpoints side-by-side</li>
                      <li>• Prevents selecting overfitted checkpoints</li>
                      <li>• Mark preferred checkpoints for easy reference</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-8 p-4 bg-muted/50 rounded-lg border-l-4 border-orange-500">
                  <p className="text-sm font-medium mb-2">💡 Use Case</p>
                  <p className="text-sm text-muted-foreground">
                    Configure predictions to generate every 100 steps during training. Watch the Prediction Evolution view to see actual responses improving from vague to accurate. If predictions aren&apos;t improving even though loss is decreasing, you&apos;ve caught overfitting in real-time.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 bg-muted/20 border-y">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold mb-4">How It Works</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                From training to deployment in three simple steps
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-card border rounded-lg p-6">
                <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center font-bold mb-4">1</div>
                <h3 className="text-xl font-semibold mb-3">Upload & Train</h3>
                <p className="text-muted-foreground mb-4">
                  Upload your JSONL dataset, select a base model (Llama, Mistral, Qwen), configure training parameters, and click train. Enable quantization to reduce costs. Training starts on RunPod cloud GPUs in seconds.
                </p>
                <Link href="/docs" className="text-sm text-green-500 hover:underline">
                  Learn about fine-tuning →
                </Link>
              </div>

              <div className="bg-card border rounded-lg p-6">
                <div className="w-10 h-10 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold mb-4">2</div>
                <h3 className="text-xl font-semibold mb-3">Monitor Training</h3>
                <p className="text-muted-foreground mb-4">
                  Watch real-time loss curves, GPU metrics, and throughput in the Training Monitor. Catch overfitting immediately when validation loss diverges. View sample predictions as the model learns.
                </p>
                <Link href="/docs" className="text-sm text-purple-500 hover:underline">
                  Learn about training analytics →
                </Link>
              </div>

              <div className="bg-card border rounded-lg p-6">
                <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold mb-4">3</div>
                <h3 className="text-xl font-semibold mb-3">Test & Evaluate</h3>
                <p className="text-muted-foreground mb-4">
                  Upload documentation to GraphRAG and test your model in the Chat Portal. Rate responses, run batch tests, and enable LLM-as-a-Judge for automated evaluation. Compare checkpoints side-by-side.
                </p>
                <Link href="/docs" className="text-sm text-blue-500 hover:underline">
                  Learn about chat testing →
                </Link>
              </div>

              <div className="bg-card border rounded-lg p-6">
                <div className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold mb-4">4</div>
                <h3 className="text-xl font-semibold mb-3">Deploy to Production</h3>
                <p className="text-muted-foreground mb-4">
                  Select the best checkpoint and deploy to RunPod Serverless with one click. Auto-scaling from 0 to 100+ GPUs. Track response times, costs, and quality metrics in Model Observability.
                </p>
                <Link href="/docs" className="text-sm text-orange-500 hover:underline">
                  Learn about deployment →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-20">
          <div className="max-w-4xl mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold mb-4">Frequently Asked Questions</h2>
              <p className="text-xl text-muted-foreground">
                Common questions about FineTune Lab features
              </p>
            </div>

            <div className="space-y-6">
              <details className="bg-card border rounded-lg p-6 group">
                <summary className="font-semibold cursor-pointer list-none flex items-center justify-between">
                  What models can I fine-tune and which training methods are supported?
                  <span className="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-4 text-muted-foreground">
                  FineTune Lab supports Llama 3.3, 3.1, 2, Mistral, Qwen, and other popular open-source models. Training methods include LoRA (efficient adaptation), full fine-tuning, SFT (Supervised Fine-Tuning), DPO, ORPO, and RLHF. You can also enable 4-bit or 8-bit quantization to reduce memory by up to 75%.
                </p>
              </details>

              <details className="bg-card border rounded-lg p-6 group">
                <summary className="font-semibold cursor-pointer list-none flex items-center justify-between">
                  How much does training cost and can I set budget limits?
                  <span className="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-4 text-muted-foreground">
                  Training costs depend on GPU type (A4000 to H100) and duration. FineTune Lab shows a live cost counter and projected total as you train. You can configure hard limits like &quot;stop at $50&quot; or &quot;stop after 10 hours&quot;. When the limit is reached, training stops automatically and saves the latest checkpoint. Resume later with a higher budget.
                </p>
              </details>

              <details className="bg-card border rounded-lg p-6 group">
                <summary className="font-semibold cursor-pointer list-none flex items-center justify-between">
                  How is FineTune Lab different from training locally?
                  <span className="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-4 text-muted-foreground">
                  FineTune Lab provides real-time analytics, intelligent testing with GraphRAG, and automated evaluation that local training doesn&apos;t offer. Instead of staring at terminal logs, you get live loss curves, GPU monitoring, and instant overfitting detection. Plus, one-click deployment to production with automatic scaling on RunPod Serverless.
                </p>
              </details>

              <details className="bg-card border rounded-lg p-6 group">
                <summary className="font-semibold cursor-pointer list-none flex items-center justify-between">
                  Can I export training data for my own analysis?
                  <span className="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-4 text-muted-foreground">
                  Yes. Export analytics in three formats: CSV (opens in Excel/Sheets), JSON (for data pipelines), and PDF (report-ready charts). All exports include training metrics, evaluation results, costs, and model comparisons with stable schemas for automated processing.
                </p>
              </details>

              <details className="bg-card border rounded-lg p-6 group">
                <summary className="font-semibold cursor-pointer list-none flex items-center justify-between">
                  What&apos;s the difference between Monitor Training and Training Analytics?
                  <span className="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-4 text-muted-foreground">
                  Monitor Training shows live metrics for one training at a time - use it while training is running. Training Analytics is for comparing multiple completed runs side-by-side with overlaid loss curves and metric tables. Use Monitor for real-time tracking, Analytics for post-training comparison.
                </p>
              </details>

              <details className="bg-card border rounded-lg p-6 group">
                <summary className="font-semibold cursor-pointer list-none flex items-center justify-between">
                  Does LLM-as-a-Judge cost extra tokens?
                  <span className="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-4 text-muted-foreground">
                  Yes, the judge model consumes tokens for each evaluation. GPT-4 and Claude Sonnet provide strong evaluation at reasonable cost. GPT-5 Pro offers exceptional reasoning but costs 10-15x more - reserve it for critical evaluations. You can also use your own fine-tuned models as judges.
                </p>
              </details>

              <details className="bg-card border rounded-lg p-6 group">
                <summary className="font-semibold cursor-pointer list-none flex items-center justify-between">
                  How do I know which checkpoint to deploy?
                  <span className="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-4 text-muted-foreground">
                  Checkpoint management uses multi-metric scoring combining eval loss, overfitting penalty (train/eval gap), perplexity, and improvement rate. The best checkpoint is automatically highlighted. You can also compare predictions from different checkpoints side-by-side to see actual response quality before deploying.
                </p>
              </details>

              <details className="bg-card border rounded-lg p-6 group">
                <summary className="font-semibold cursor-pointer list-none flex items-center justify-between">
                  Can I use GraphRAG for production inference?
                  <span className="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-4 text-muted-foreground">
                  GraphRAG is primarily designed for testing and evaluation during model development. It helps you validate context usage and response accuracy with citation-backed answers. For production RAG, you&apos;d typically integrate your own vector database or knowledge graph with deployed model endpoints.
                </p>
              </details>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 border-t">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to Train Your First Model?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Start with our free tier. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/welcome" className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 h-11 rounded-md px-8">
                Get Started Free
              </Link>
              <Link href="/contact" className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer border border-input bg-background hover:bg-accent hover:text-accent-foreground h-11 rounded-md px-8">
                Talk to Sales
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
