import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'FineTuneLab Alternatives - Compare LLM Fine-Tuning Platforms 2026',
  description: 'Compare FineTuneLab to Weights & Biases, LangSmith, MLflow, and Airflow. See why teams choose our visual DAG workflow for LLM fine-tuning, testing, and production monitoring.',
  keywords: [
    'finetunelab alternatives',
    'llm fine-tuning platform comparison',
    'weights and biases alternative',
    'langsmith alternative',
    'mlflow alternative',
    'airflow for ai alternative',
    'visual dag ai training',
    'closed-loop monitoring'
  ],
  openGraph: {
    title: 'FineTuneLab Alternatives - Compare LLM Platforms',
    description: 'Compare FineTuneLab to leading platforms. Visual DAG workflows, closed-loop monitoring, and production-ready AI training.',
    type: 'website',
  },
};

const competitors = [
  {
    name: 'Weights & Biases',
    slug: 'weights-and-biases',
    category: 'Experiment Tracking',
    description: 'Popular ML experiment tracking and model monitoring platform',
    bestFor: 'Teams focused on experiment tracking and collaboration',
  },
  {
    name: 'LangSmith',
    slug: 'langsmith',
    category: 'LLM Observability',
    description: 'LangChain\'s debugging and testing platform for LLM applications',
    bestFor: 'LangChain users building LLM applications',
  },
  {
    name: 'Airflow',
    slug: 'airflow',
    category: 'Workflow Orchestration',
    description: 'General-purpose workflow orchestration platform',
    bestFor: 'Data engineering teams with existing Airflow infrastructure',
  },
  {
    name: 'MLflow',
    slug: 'mlflow',
    category: 'ML Lifecycle',
    description: 'Open-source platform for the ML lifecycle',
    bestFor: 'Teams wanting open-source flexibility',
  },
];

const fineTuneLabAdvantages = [
  {
    title: 'Visual DAG Workflows',
    description: 'No shell scripts or YAML configs. Build AI training workflows visually.',
  },
  {
    title: 'Closed-Loop Monitoring',
    description: 'From training to production - monitor model drift and performance continuously.',
  },
  {
    title: 'Built for LLM Fine-Tuning',
    description: 'Native support for LoRA, QLoRA, DPO, RLHF with RunPod GPU integration.',
  },
  {
    title: 'Batch Testing & Evaluation',
    description: 'Test multiple models side-by-side with automated LLM-as-Judge scoring.',
  },
  {
    title: 'GraphRAG Integration',
    description: 'Built-in knowledge graph integration for reduced hallucinations.',
  },
  {
    title: 'Real-Time Analytics',
    description: 'WebSocket-powered live metrics, GPU tracking, and prediction monitoring.',
  },
];

export default function AlternativesPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          FineTuneLab vs Other Platforms
        </h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          Compare FineTuneLab to leading ML platforms. See why teams choose our 
          visual DAG workflow for closed-loop AI training and monitoring.
        </p>
      </div>

      {/* Why Teams Switch Section */}
      <Card className="mb-12">
        <CardHeader>
          <CardTitle>Why Teams Switch to FineTuneLab</CardTitle>
          <CardDescription>
            The only platform combining visual workflows, LLM fine-tuning, and production monitoring
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {fineTuneLabAdvantages.map((advantage) => (
              <div key={advantage.title} className="flex gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold mb-1">{advantage.title}</h3>
                  <p className="text-sm text-muted-foreground">{advantage.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Comparison Grid */}
      <div className="mb-12">
        <h2 className="text-3xl font-bold mb-6 text-center">
          Compare FineTuneLab to:
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {competitors.map((competitor) => (
            <Card key={competitor.slug} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">{competitor.name}</CardTitle>
                    <CardDescription className="mt-1">{competitor.category}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {competitor.description}
                </p>
                <p className="text-sm mb-4">
                  <strong>Best for:</strong> {competitor.bestFor}
                </p>
                <Link href={`/alternatives/${competitor.slug}`}>
                  <Button variant="outline" className="w-full">
                    View Detailed Comparison
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Quick Comparison Table */}
      <Card className="mb-12">
        <CardHeader>
          <CardTitle>Feature Comparison at a Glance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2">Feature</th>
                  <th className="text-center py-3 px-2">FineTuneLab</th>
                  <th className="text-center py-3 px-2">W&B</th>
                  <th className="text-center py-3 px-2">LangSmith</th>
                  <th className="text-center py-3 px-2">MLflow</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-3 px-2">Visual DAG Workflows</td>
                  <td className="text-center"><CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" /></td>
                  <td className="text-center"><XCircle className="h-5 w-5 text-gray-300 mx-auto" /></td>
                  <td className="text-center"><XCircle className="h-5 w-5 text-gray-300 mx-auto" /></td>
                  <td className="text-center"><XCircle className="h-5 w-5 text-gray-300 mx-auto" /></td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-2">LLM Fine-Tuning (LoRA/DPO)</td>
                  <td className="text-center"><CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" /></td>
                  <td className="text-center"><XCircle className="h-5 w-5 text-gray-300 mx-auto" /></td>
                  <td className="text-center"><XCircle className="h-5 w-5 text-gray-300 mx-auto" /></td>
                  <td className="text-center"><XCircle className="h-5 w-5 text-gray-300 mx-auto" /></td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-2">Production Monitoring</td>
                  <td className="text-center"><CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" /></td>
                  <td className="text-center"><CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" /></td>
                  <td className="text-center"><CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" /></td>
                  <td className="text-center"><XCircle className="h-5 w-5 text-gray-300 mx-auto" /></td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-2">GraphRAG Integration</td>
                  <td className="text-center"><CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" /></td>
                  <td className="text-center"><XCircle className="h-5 w-5 text-gray-300 mx-auto" /></td>
                  <td className="text-center"><XCircle className="h-5 w-5 text-gray-300 mx-auto" /></td>
                  <td className="text-center"><XCircle className="h-5 w-5 text-gray-300 mx-auto" /></td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-2">Batch Testing</td>
                  <td className="text-center"><CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" /></td>
                  <td className="text-center"><XCircle className="h-5 w-5 text-gray-300 mx-auto" /></td>
                  <td className="text-center"><CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" /></td>
                  <td className="text-center"><XCircle className="h-5 w-5 text-gray-300 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3 px-2">Cloud GPU Integration</td>
                  <td className="text-center"><CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" /></td>
                  <td className="text-center"><XCircle className="h-5 w-5 text-gray-300 mx-auto" /></td>
                  <td className="text-center"><XCircle className="h-5 w-5 text-gray-300 mx-auto" /></td>
                  <td className="text-center"><XCircle className="h-5 w-5 text-gray-300 mx-auto" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* CTA Section */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 border-2">
        <CardContent className="p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">
            Ready to Try FineTuneLab?
          </h2>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Join teams building production-ready LLMs with visual workflows, 
            automated testing, and real-time monitoring.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button size="lg" className="w-full sm:w-auto">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/demo">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Schedule Demo
              </Button>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            15-day free trial • No credit card required
          </p>
        </CardContent>
      </Card>

      {/* FAQ Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              {
                "@type": "Question",
                "name": "What makes FineTuneLab different from Weights & Biases?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "FineTuneLab is purpose-built for LLM fine-tuning with visual DAG workflows, while W&B focuses on general ML experiment tracking. We include built-in support for LoRA, QLoRA, DPO, RLHF, RunPod GPU integration, and GraphRAG knowledge graphs - all with no code configuration."
                }
              },
              {
                "@type": "Question",
                "name": "Can I migrate from Airflow to FineTuneLab?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Yes. FineTuneLab replaces Airflow's complex DAGs and Python operators with visual workflow building. No more YAML configs or shell scripts. Your AI training workflows become drag-and-drop components with built-in monitoring and testing."
                }
              },
              {
                "@type": "Question",
                "name": "How does FineTuneLab compare to LangSmith?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "LangSmith focuses on debugging LangChain applications, while FineTuneLab provides end-to-end fine-tuning, testing, and production monitoring. We support the full lifecycle from training (SFT, DPO, RLHF) to deployment and drift detection."
                }
              }
            ]
          })
        }}
      />
    </div>
  );
}
