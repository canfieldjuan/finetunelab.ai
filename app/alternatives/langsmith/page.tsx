import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = {
  title: 'FineTuneLab vs LangSmith - LLM Platform Comparison 2026',
  description: 'Compare FineTuneLab to LangSmith. End-to-end LLM fine-tuning vs LangChain debugging. See the difference in workflows, testing, and production monitoring.',
  keywords: ['finetunelab vs langsmith', 'langsmith alternative', 'llm fine-tuning vs debugging'],
};

export default function Page() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <Link href="/alternatives" className="text-sm text-muted-foreground hover:text-foreground flex items-center mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Comparisons
      </Link>

      <Badge className="mb-4">Comparison</Badge>
      <h1 className="text-4xl font-bold mb-4">FineTuneLab vs LangSmith</h1>
      <p className="text-xl text-muted-foreground mb-12">
        Complete LLM fine-tuning platform vs LangChain debugging and testing tool.
      </p>

      <Card className="mb-8">
        <CardHeader><CardTitle>Key Differences</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">FineTuneLab</h3>
            <p className="text-sm text-muted-foreground">
              End-to-end platform for fine-tuning LLMs (SFT, DPO, RLHF), batch testing, 
              and production monitoring. Includes GPU provisioning and GraphRAG.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">LangSmith</h3>
            <p className="text-sm text-muted-foreground">
              Debugging and testing tool for LangChain applications. 
              Focused on tracing LangChain workflows and prompt engineering.
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
