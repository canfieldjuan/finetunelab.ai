'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { PageHeader } from '@/components/layout/PageHeader';
import { LoadingState } from '@/components/ui/LoadingState';
import { ArrowLeft, Package, Copy, Check, Terminal } from 'lucide-react';

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className="bg-zinc-900 text-zinc-100 p-4 rounded-lg overflow-x-auto text-sm">
        <code>{code}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-2 bg-zinc-700 hover:bg-zinc-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default function SDKDocsPage() {
  const { user, signOut, loading } = useAuth();
  const router = useRouter();

  if (loading) {
    return <LoadingState fullScreen />;
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  return (
    <PageWrapper currentPage="docs" user={user} signOut={signOut}>
      <div className="mb-6">
        <Link href="/docs" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Documentation
        </Link>
      </div>

      <PageHeader
        title="Official SDKs"
        description="Python and Node.js SDKs for FineTune Lab API"
      />

      <div className="space-y-12">
        {/* Installation Section */}
        <section>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Terminal className="w-6 h-6" />
            Installation
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Python */}
            <div className="border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Package className="w-6 h-6 text-blue-500" />
                <h3 className="text-xl font-semibold">Python</h3>
              </div>
              <p className="text-muted-foreground mb-4">
                Install from PyPI:
              </p>
              <CodeBlock
                
                code={`# API client only (lightweight)
pip install finetune-lab

# With training dependencies (requires GPU)
pip install finetune-lab[training]`}
              />
              <p className="text-sm text-muted-foreground mt-3">
                <a href="https://pypi.org/project/finetune-lab/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  View on PyPI
                </a>
              </p>
            </div>

            {/* Node.js */}
            <div className="border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Package className="w-6 h-6 text-green-500" />
                <h3 className="text-xl font-semibold">Node.js / TypeScript</h3>
              </div>
              <p className="text-muted-foreground mb-4">
                Install from npm:
              </p>
              <CodeBlock
                
                code={`npm install @finetunelab/sdk
# or
yarn add @finetunelab/sdk
# or
pnpm add @finetunelab/sdk`}
              />
              <p className="text-sm text-muted-foreground mt-3">
                <a href="https://www.npmjs.com/package/@finetunelab/sdk" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  View on npm
                </a>
              </p>
            </div>
          </div>
        </section>

        {/* Quick Start Section */}
        <section>
          <h2 className="text-2xl font-bold mb-6">Quick Start</h2>

          <div className="space-y-8">
            {/* Python Quick Start */}
            <div>
              <h3 className="text-xl font-semibold mb-4">Python</h3>
              <CodeBlock
                
                code={`from finetune_lab import FinetuneLabClient

# Initialize with API key
client = FinetuneLabClient(api_key="wak_your_api_key_here")
# Or set FINETUNE_LAB_API_KEY environment variable

# Run inference
response = client.predict(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.content)

# Run batch test
test = client.batch_test.run(
    model_id="your-model-id",
    test_suite_id="your-test-suite-id"
)
print(f"Test started: {test.test_id}")

# Check batch test status
status = client.batch_test.status(test.test_id)
print(f"Progress: {status.completed}/{status.total_prompts}")`}
              />
            </div>

            {/* Node.js Quick Start */}
            <div>
              <h3 className="text-xl font-semibold mb-4">Node.js / TypeScript</h3>
              <CodeBlock
                
                code={`import { FinetuneLabClient } from '@finetunelab/sdk';

// Initialize with API key
const client = new FinetuneLabClient({
  apiKey: 'wak_your_api_key_here',
  // Or set FINETUNE_LAB_API_KEY environment variable
});

// Run inference
const response = await client.predict({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});
console.log(response.choices[0].message.content);

// Run batch test
const test = await client.batchTest.run({
  modelId: 'your-model-id',
  testSuiteId: 'your-test-suite-id',
});
console.log(\`Test started: \${test.testId}\`);

// Check batch test status
const status = await client.batchTest.status(test.testId);
console.log(\`Progress: \${status.completedPrompts}/\${status.totalPrompts}\`);`}
              />
            </div>
          </div>
        </section>

        {/* API Key Scopes Section */}
        <section>
          <h2 className="text-2xl font-bold mb-6">API Key Scopes</h2>
          <p className="text-muted-foreground mb-4">
            Your API key must have the appropriate scope for each operation:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold">Operation</th>
                  <th className="text-left py-3 px-4 font-semibold">Required Scope</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-3 px-4"><code className="bg-muted px-2 py-1 rounded">predict()</code></td>
                  <td className="py-3 px-4"><code className="bg-muted px-2 py-1 rounded">production</code> or <code className="bg-muted px-2 py-1 rounded">all</code></td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4"><code className="bg-muted px-2 py-1 rounded">batch_test.*</code></td>
                  <td className="py-3 px-4"><code className="bg-muted px-2 py-1 rounded">testing</code> or <code className="bg-muted px-2 py-1 rounded">all</code></td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4"><code className="bg-muted px-2 py-1 rounded">analytics.*</code></td>
                  <td className="py-3 px-4"><code className="bg-muted px-2 py-1 rounded">production</code> or <code className="bg-muted px-2 py-1 rounded">all</code></td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4"><code className="bg-muted px-2 py-1 rounded">training.*</code></td>
                  <td className="py-3 px-4"><code className="bg-muted px-2 py-1 rounded">training</code> or <code className="bg-muted px-2 py-1 rounded">all</code></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Batch Testing Section */}
        <section>
          <h2 className="text-2xl font-bold mb-6">Batch Testing</h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">Python</h3>
              <CodeBlock
                
                code={`# Run a batch test
test = client.batch_test.run(
    model_id="your-model-id",
    test_suite_id="suite_abc123",  # From your test suites
    prompt_limit=50,               # Max prompts to test
    concurrency=5,                 # Parallel requests
)

# Poll for completion
import time
while True:
    status = client.batch_test.status(test.test_id)
    print(f"Status: {status.status} - {status.completed}/{status.total_prompts}")
    if status.status in ["completed", "failed", "cancelled"]:
        break
    time.sleep(5)

# Cancel if needed
client.batch_test.cancel(test.test_id)`}
              />
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">Node.js</h3>
              <CodeBlock
                
                code={`// Run a batch test
const test = await client.batchTest.run({
  modelId: 'your-model-id',
  testSuiteId: 'suite_abc123',
  promptLimit: 50,
  concurrency: 5,
});

// Poll for completion
while (true) {
  const status = await client.batchTest.status(test.testId);
  console.log(\`Status: \${status.status} - \${status.completedPrompts}/\${status.totalPrompts}\`);
  if (['completed', 'failed', 'cancelled'].includes(status.status)) break;
  await new Promise(r => setTimeout(r, 5000));
}

// Cancel if needed
await client.batchTest.cancel(test.testId);`}
              />
            </div>
          </div>
        </section>

        {/* Analytics Section */}
        <section>
          <h2 className="text-2xl font-bold mb-6">Analytics</h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">Python</h3>
              <CodeBlock
                
                code={`# Get traces
traces = client.analytics.traces(limit=50, offset=0)
for trace in traces["traces"]:
    print(f"{trace['span_name']}: {trace['duration_ms']}ms")

# Get aggregated data
data = client.analytics.data(
    start_date="2025-01-01",
    end_date="2025-01-31",
    granularity="day"
)
print(f"Total requests: {data['summary']['totalRequests']}")`}
              />
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">Node.js</h3>
              <CodeBlock
                
                code={`// Get traces
const traces = await client.analytics.traces({ limit: 50 });
for (const trace of traces.traces) {
  console.log(\`\${trace.spanName}: \${trace.durationMs}ms\`);
}

// Get aggregated data
const data = await client.analytics.data({
  startDate: '2025-01-01',
  endDate: '2025-01-31',
  granularity: 'day',
});
console.log(\`Total requests: \${data.summary.totalRequests}\`);`}
              />
            </div>
          </div>
        </section>

        {/* Error Handling Section */}
        <section>
          <h2 className="text-2xl font-bold mb-6">Error Handling</h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">Python</h3>
              <CodeBlock
                
                code={`from finetune_lab import FinetuneLabClient, FinetuneLabError

try:
    response = client.predict(model="invalid", messages=[])
except FinetuneLabError as e:
    print(f"Error {e.status_code}: {e.message}")
    # Access full response if available
    print(e.response)`}
              />
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">Node.js</h3>
              <CodeBlock
                
                code={`import { FinetuneLabClient, FinetuneLabError } from '@finetunelab/sdk';

try {
  await client.predict({ model: 'invalid', messages: [] });
} catch (error) {
  if (error instanceof FinetuneLabError) {
    console.error(\`Error \${error.statusCode}: \${error.message}\`);
    console.error('Type:', error.type);
  }
}`}
              />
            </div>
          </div>
        </section>

        {/* Environment Variables Section */}
        <section>
          <h2 className="text-2xl font-bold mb-6">Environment Variables</h2>
          <p className="text-muted-foreground mb-4">
            Both SDKs support configuration via environment variables:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold">Variable</th>
                  <th className="text-left py-3 px-4 font-semibold">Description</th>
                  <th className="text-left py-3 px-4 font-semibold">Default</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-3 px-4"><code className="bg-muted px-2 py-1 rounded">FINETUNE_LAB_API_KEY</code></td>
                  <td className="py-3 px-4">Your API key</td>
                  <td className="py-3 px-4 text-muted-foreground">Required</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4"><code className="bg-muted px-2 py-1 rounded">FINETUNE_LAB_API_URL</code></td>
                  <td className="py-3 px-4">Custom API base URL</td>
                  <td className="py-3 px-4"><code className="bg-muted px-2 py-1 rounded text-xs">https://app.finetunelab.com</code></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Links Section */}
        <section className="border-t pt-8">
          <h2 className="text-2xl font-bold mb-6">Resources</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <a
              href="https://pypi.org/project/finetune-lab/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 border rounded-lg hover:bg-muted transition-colors"
            >
              <h3 className="font-semibold mb-1">Python SDK on PyPI</h3>
              <p className="text-sm text-muted-foreground">finetune-lab v0.2.0</p>
            </a>
            <a
              href="https://www.npmjs.com/package/@finetunelab/sdk"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 border rounded-lg hover:bg-muted transition-colors"
            >
              <h3 className="font-semibold mb-1">Node.js SDK on npm</h3>
              <p className="text-sm text-muted-foreground">@finetunelab/sdk v0.2.0</p>
            </a>
          </div>
        </section>
      </div>
    </PageWrapper>
  );
}
