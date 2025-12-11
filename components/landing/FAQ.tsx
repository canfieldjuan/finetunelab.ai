"use client";

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    question: "How long does setup take?",
    answer: "5 minutes. Add 1 line of JavaScript to your site. No backend integration required. Works with any AI provider (OpenAI, Anthropic, AWS Bedrock, Azure, local models)."
  },
  {
    question: "Does it work with my AI provider?",
    answer: "Yes. We're provider-agnostic. Works with OpenAI, Anthropic Claude, AWS Bedrock, Azure OpenAI, Google Vertex AI, Cohere, local models (Ollama, vLLM), and custom endpoints."
  },
  {
    question: "Is my customer data secure?",
    answer: "Absolutely. Multi-tenant data isolation, PII filtering built-in, SOC 2 Type II compliant, GDPR ready, data encrypted at rest and in transit. You can also self-host for maximum control."
  },
  {
    question: "What if I have low traffic?",
    answer: "Our Starter plan includes 10,000 conversations/month for just $49. Perfect for early-stage products. Upgrade as you grow."
  },
  {
    question: "Can I cancel anytime?",
    answer: "Yes. No contracts. No lock-in. Cancel with one click. Export all your data before you go."
  },
  {
    question: "Do I need to be technical?",
    answer: "No. Copy/paste the widget code (1 line). Everything else is UI-based—no SQL, no coding. Our natural language analytics chat lets you ask questions in plain English."
  },
  {
    question: "What formats can I export training data in?",
    answer: "JSONL, CSV, Parquet. We support DPO (Direct Preference Optimization), RLHF (Reinforcement Learning from Human Feedback), and SFT (Supervised Fine-Tuning) formats out of the box."
  },
  {
    question: "Can I try before buying?",
    answer: "Yes! 14-day free trial. No credit card required. Full access to all features. Experience the complete platform risk-free."
  },
  {
    question: "How is this different from LangSmith or Weights & Biases?",
    answer: "They focus on ML experiment tracking. We focus on the complete production-to-training loop: embed widget → capture conversations → human ratings → 7 advanced analytics → export training data → retrain → measure improvement."
  },
  {
    question: "What about Heap or Mixpanel?",
    answer: "They're product analytics tools—they don't support human ratings, training data export, or AI-specific quality metrics. We're built specifically for AI quality intelligence."
  },
  {
    question: "Can I use this for local/on-prem models?",
    answer: "Yes! Works with any model that has an API endpoint—cloud providers, local models (Ollama, vLLM), or your own custom-trained models."
  },
  {
    question: "Do you offer enterprise plans?",
    answer: "Yes. Our Enterprise plan ($999/mo) includes unlimited conversations, dedicated support, SLA guarantees, and custom integrations. Contact us for volume discounts."
  }
];

export function FAQ() {
  console.log("[FAQ] Component mounted");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="py-20 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-4xl md:text-5xl font-bold">
            Frequently Asked Questions
          </h2>
          <p className="text-xl text-muted-foreground">
            Everything you need to know before getting started
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="border-2 rounded-lg overflow-hidden transition-all hover:border-primary/50"
            >
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full flex items-center justify-between p-6 text-left bg-card hover:bg-muted/50 transition-colors"
              >
                <span className="font-semibold text-lg pr-4">{faq.question}</span>
                <ChevronDown
                  className={`w-5 h-5 text-muted-foreground flex-shrink-0 transition-transform ${
                    openIndex === index ? "rotate-180" : ""
                  }`}
                />
              </button>

              {openIndex === index && (
                <div className="px-6 pb-6 pt-2 bg-muted/30">
                  <p className="text-muted-foreground leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Still have questions CTA */}
        <div className="mt-12 text-center p-8 rounded-xl bg-gradient-to-br from-primary/5 via-background to-accent/5 border-2 border-primary/20">
          <h3 className="text-xl font-bold mb-2">Still have questions?</h3>
          <p className="text-muted-foreground mb-4">
            We&apos;re here to help. Book a demo or reach out to our team.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors">
              Schedule Demo
            </button>
            <button className="px-6 py-2 rounded-lg border-2 border-blue-500/30 font-medium hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors">
              Contact Sales
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
