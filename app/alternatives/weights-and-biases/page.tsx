import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = {
  title: 'FineTuneLab vs Weights & Biases - LLM Fine-Tuning Comparison 2026',
  description: 'Compare FineTuneLab to Weights & Biases. Purpose-built LLM fine-tuning platform vs code-based tracking. See why teams choose FineTuneLab for production LLM fine-tuning.',
  keywords: ['finetunelab vs wandb', 'weights and biases alternative', 'llm fine-tuning platform'],
};

export default function Page() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <Link href="/alternatives" className="text-sm text-muted-foreground hover:text-foreground flex items-center mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Comparisons
      </Link>

      <Badge className="mb-4">Comparison</Badge>
      <h1 className="text-4xl font-bold mb-4">FineTuneLab vs Weights & Biases</h1>
      <p className="text-xl text-muted-foreground mb-12">
        Purpose-built LLM fine-tuning platform vs general ML experiment tracking.
      </p>

      <Card className="mb-8">
        <CardHeader><CardTitle>Key Differences</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">FineTuneLab</h3>
            <p className="text-sm text-muted-foreground">
              Purpose-built for LLM fine-tuning with visual workflows, GPU provisioning, 
              and production monitoring. No code required.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Weights & Biases</h3>
            <p className="text-sm text-muted-foreground">
              General ML experiment tracking requiring SDK integration. 
              Strong for diverse ML experiments.
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
