import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = {
  title: 'FineTuneLab vs Airflow - AI Workflow Orchestration Comparison 2026',
  description: 'Compare FineTuneLab to Apache Airflow. Purpose-built LLM fine-tuning platform vs code-based workflow orchestration. Why teams switch from Airflow to FineTuneLab for LLM training.',
  keywords: ['finetunelab vs airflow', 'airflow alternative ai', 'llm training platform vs airflow', 'ai workflow orchestration'],
};

export default function Page() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <Link href="/alternatives" className="text-sm text-muted-foreground hover:text-foreground flex items-center mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Comparisons
      </Link>

      <Badge className="mb-4">Comparison</Badge>
      <h1 className="text-4xl font-bold mb-4">FineTuneLab vs Apache Airflow</h1>
      <p className="text-xl text-muted-foreground mb-12">
        Purpose-built LLM fine-tuning platform vs code-based workflow orchestration.
      </p>

      <Card className="mb-8">
        <CardHeader><CardTitle>Key Differences</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">FineTuneLab</h3>
            <p className="text-sm text-muted-foreground">
              Purpose-built platform for LLM fine-tuning with intuitive configuration. No Python operators or YAML configs. 
              Built-in LLM fine-tuning, testing, monitoring, and GPU provisioning.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Apache Airflow</h3>
            <p className="text-sm text-muted-foreground">
              General-purpose workflow orchestrator requiring Python DAG definitions. 
              Strong for data pipelines but requires custom code for AI training tasks.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
        <CardContent className="p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Try FineTuneLab</h2>
          <Link href="/signup">
            <Button size="lg">
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
