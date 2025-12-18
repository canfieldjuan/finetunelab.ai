import { Metadata } from 'next';
import HomeRedirect from './HomeRedirect';
import { softwareSchema, generateFAQSchema } from '@/lib/seo/config';

export const metadata: Metadata = {
  title: "Fine Tune Lab - From Fine-Tuning to Production Monitoring",
  description: "AI training platform for fine-tuning LLMs with RunPod cloud GPUs, GraphRAG knowledge integration, automated evaluation, and real-time analytics. Train models with SFT, DPO, RLHF, and deploy with confidence.",
  openGraph: {
    title: "Fine Tune Lab - From Fine-Tuning to Production Monitoring",
    description: "AI training platform for fine-tuning LLMs with RunPod cloud GPUs, GraphRAG knowledge integration, automated evaluation, and real-time analytics.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fine Tune Lab - From Fine-Tuning to Production Monitoring",
    description: "AI training platform for fine-tuning LLMs with RunPod cloud GPUs, GraphRAG knowledge integration, automated evaluation, and real-time analytics.",
  },
};

// FAQ schema data for AI crawlers
const faqData = [
  {
    question: "What is Fine Tune Lab?",
    answer: "Fine Tune Lab is an AI training platform that enables you to fine-tune large language models using cloud GPUs, integrate knowledge graphs with GraphRAG, and evaluate model performance with automated testing and real-time analytics."
  },
  {
    question: "How do I train a model with Fine Tune Lab?",
    answer: "Upload your training data in JSONL format, select a base model from HuggingFace (like Llama or Mistral), configure training parameters, and launch training on RunPod cloud GPUs. Monitor progress in real-time with live metrics and logs."
  },
  {
    question: "What training methods does Fine Tune Lab support?",
    answer: "We support SFT (Supervised Fine-Tuning), DPO (Direct Preference Optimization), RLHF (Reinforcement Learning from Human Feedback), and ORPO. All methods are optimized for efficiency with Unsloth acceleration."
  },
  {
    question: "What is GraphRAG and how does it work?",
    answer: "GraphRAG (Graph Retrieval-Augmented Generation) integrates your documents into a Neo4j knowledge graph, allowing your fine-tuned models to retrieve relevant context from your data. This reduces hallucinations and improves answer accuracy by grounding responses in your actual documents."
  },
  {
    question: "Can I test my model before deploying?",
    answer: "Yes. Use our batch testing feature to run your model against test suites, compare multiple models side-by-side, and evaluate with automated LLM-as-Judge scoring. Export results for analysis or use our analytics dashboard to identify improvement opportunities."
  },
  {
    question: "What cloud providers does Fine Tune Lab use?",
    answer: "We primarily use RunPod for GPU training and inference, with support for multiple GPU types (A100, H100, RTX 4090). You can also deploy locally or use other providers through custom endpoints."
  },
  {
    question: "How much does it cost?",
    answer: "Pro plan is $297/month with unlimited training (you pay RunPod directly for GPU usage). Pro Plus is $497/month for teams. Enterprise plans start at $997/month with dedicated support and custom SLA."
  },
  {
    question: "Do you offer a free trial?",
    answer: "Yes! 15-day free trial with full Pro features. No credit card required. Experience the complete platform including GraphRAG, batch testing, and analytics."
  }
];

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(generateFAQSchema(faqData)) }}
      />
      <HomeRedirect />
    </>
  );
}
