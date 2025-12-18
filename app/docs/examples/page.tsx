'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { Copy, Check } from 'lucide-react';

export default function ExamplesPage() {
  const { user, signOut, loading } = useAuth();
  const router = useRouter();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Public page - no auth required
  // if (loading) {
  //   return (
  //     <div className="flex items-center justify-center min-h-screen">
  //       <div className="text-center">
  //         <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
  //         <p className="text-gray-600">Loading...</p>
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar currentPage="docs-examples" user={user} signOut={signOut} />
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-4xl mx-auto p-8">
          <h1 className="text-4xl font-bold mb-4">💻 Examples</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Real working code in Python, JavaScript, and cURL
          </p>

          {/* Table of Contents */}
          <nav className="mb-12 p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
            <h2 className="text-lg font-semibold mb-4">📋 Quick Navigation</h2>
            <div className="grid gap-2 text-sm">
              <a href="#python-sdk" className="text-blue-600 dark:text-blue-400 hover:underline">
                Python SDK Examples
              </a>
              <a href="#javascript" className="text-blue-600 dark:text-blue-400 hover:underline">
                JavaScript/TypeScript Examples
              </a>
              <a href="#curl" className="text-blue-600 dark:text-blue-400 hover:underline">
                cURL Command Reference
              </a>
              <a href="#inference-deployment" className="text-orange-600 dark:text-orange-400 hover:underline font-semibold">
                🚀 Inference Deployment Examples
              </a>
              <a href="#end-to-end" className="text-blue-600 dark:text-blue-400 hover:underline">
                End-to-End Workflows
              </a>
            </div>
          </nav>

          {/* Python SDK Examples */}
          <section id="python-sdk" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-blue-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">🐍 Python SDK Examples</h2>
              <p className="text-muted-foreground">Complete Python scripts ready to run</p>
            </div>

            <div className="space-y-8">
              {/* Example 1: Complete Training Script */}
              <div>
                <h3 className="text-xl font-semibold mb-3">Complete Training Script</h3>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold">train_model.py</h4>
                    <button
                      onClick={() => copyToClipboard(
`import requests
import time
import json

# Configuration
API_BASE = "https://finetunelab.ai"
AUTH_TOKEN = "your-auth-token-here"

headers = {
    "Authorization": f"Bearer {AUTH_TOKEN}",
    "Content-Type": "application/json"
}

# Step 1: Upload dataset
def upload_dataset(file_path, dataset_name):
    url = f"{API_BASE}/api/training/datasets"
    files = {"file": open(file_path, "rb")}
    data = {"name": dataset_name}
    response = requests.post(url, files=files, data=data)
    return response.json()["dataset_id"]

# Step 2: Create training config
def create_config(dataset_id):
    url = f"{API_BASE}/api/training"
    payload = {
        "name": "my-finetuned-model",
        "base_model": "meta-llama/Llama-3.2-1B",
        "dataset_id": dataset_id,
        "learning_rate": 0.0001,
        "batch_size": 4,
        "epochs": 3
    }
    response = requests.post(url, json=payload, headers=headers)
    return response.json()["id"]

# Step 3: Start training
def start_training(config_id):
    url = f"{API_BASE}/api/training/execute"
    payload = {"id": config_id}
    response = requests.post(url, json=payload, headers=headers)
    return response.json()["job_id"]

# Step 4: Monitor training
def monitor_training(job_id):
    url = f"{API_BASE}/api/training/metrics/{job_id}"
    while True:
        response = requests.get(url, headers=headers)
        metrics = response.json()
        
        print(f"Step {metrics['current_step']}/{metrics['total_steps']}")
        print(f"Loss: {metrics['train_loss']:.4f}")
        print(f"Epoch: {metrics['epoch']}")
        
        if metrics.get("status") == "completed":
            print("Training completed!")
            break
            
        time.sleep(10)

# Main execution
if __name__ == "__main__":
    # Upload dataset
    dataset_id = upload_dataset("training_data.jsonl", "My Dataset")
    print(f"Dataset uploaded: {dataset_id}")
    
    # Create config
    config_id = create_config(dataset_id)
    print(f"Config created: {config_id}")
    
    # Start training
    job_id = start_training(config_id)
    print(f"Training started: {job_id}")
    
    # Monitor progress
    monitor_training(job_id)`,
                        'python-complete'
                      )}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
                    >
                      {copiedCode === 'python-complete' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copiedCode === 'python-complete' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm text-slate-100">
                      <code>{`import requests
import time

API_BASE = "https://finetunelab.ai"
AUTH_TOKEN = "your-token"

headers = {
    "Authorization": f"Bearer {AUTH_TOKEN}",
    "Content-Type": "application/json"
}

def monitor_training(job_id):
    url = f"{API_BASE}/api/training/metrics/{job_id}"
    while True:
        response = requests.get(url, headers=headers)
        metrics = response.json()
        
        print(f"Step {metrics['current_step']}/{metrics['total_steps']}")
        print(f"Loss: {metrics['train_loss']:.4f}")
        
        if metrics.get("status") == "completed":
            break
        time.sleep(10)`}</code>
                    </pre>
                  </div>
                </div>
              </div>

              {/* Example 2: Dataset Validation */}
              <div>
                <h3 className="text-xl font-semibold mb-3">Dataset Validation Script</h3>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold">validate_dataset.py</h4>
                    <button
                      onClick={() => copyToClipboard(
`import json
import sys

def validate_jsonl(file_path):
    """Validate JSONL dataset format"""
    errors = []
    line_num = 0
    
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            line_num += 1
            
            # Check valid JSON
            try:
                data = json.loads(line.strip())
            except json.JSONDecodeError as e:
                errors.append(f"Line {line_num}: Invalid JSON - {e}")
                continue
            
            # Check messages array exists
            if "messages" not in data:
                errors.append(f"Line {line_num}: Missing 'messages' field")
                continue
            
            # Validate messages structure
            messages = data["messages"]
            if not isinstance(messages, list):
                errors.append(f"Line {line_num}: 'messages' must be an array")
                continue
            
            # Check each message
            for i, msg in enumerate(messages):
                if "role" not in msg:
                    errors.append(f"Line {line_num}, Message {i}: Missing 'role'")
                if "content" not in msg:
                    errors.append(f"Line {line_num}, Message {i}: Missing 'content'")
                if msg.get("content", "").strip() == "":
                    errors.append(f"Line {line_num}, Message {i}: Empty content")
    
    return errors, line_num

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python validate_dataset.py <file.jsonl>")
        sys.exit(1)
    
    file_path = sys.argv[1]
    errors, total_lines = validate_jsonl(file_path)
    
    if errors:
        print(f"❌ Found {len(errors)} errors:")
        for error in errors[:10]:  # Show first 10
            print(f"  {error}")
    else:
        print(f"✅ Valid dataset with {total_lines} examples")`,
                        'python-validate'
                      )}
                      className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1"
                    >
                      {copiedCode === 'python-validate' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copiedCode === 'python-validate' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm text-slate-100">
                      <code>{`import json

def validate_jsonl(file_path):
    errors = []
    with open(file_path, 'r') as f:
        for i, line in enumerate(f, 1):
            try:
                data = json.loads(line)
                if "messages" not in data:
                    errors.append(f"Line {i}: Missing messages")
            except json.JSONDecodeError:
                errors.append(f"Line {i}: Invalid JSON")
    return errors`}</code>
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* JavaScript Examples */}
          <section id="javascript" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-yellow-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">⚡ JavaScript/TypeScript Examples</h2>
              <p className="text-muted-foreground">Modern async/await patterns for Node.js and browsers</p>
            </div>

            <div className="space-y-8">
              {/* Example 1: Training Client Class */}
              <div>
                <h3 className="text-xl font-semibold mb-3">Training Client Class</h3>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold">TrainingClient.ts</h4>
                    <button
                      onClick={() => copyToClipboard(
`class TrainingClient {
  private baseUrl: string;
  private authToken: string;

  constructor(baseUrl: string, authToken: string) {
    this.baseUrl = baseUrl;
    this.authToken = authToken;
  }

  private async fetch(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(\`\${this.baseUrl}\${endpoint}\`, {
      ...options,
      headers: {
        'Authorization': \`Bearer \${this.authToken}\`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(\`API Error: \${response.statusText}\`);
    }

    return response.json();
  }

  async createConfig(config: {
    name: string;
    base_model: string;
    dataset_id: string;
    learning_rate?: number;
    batch_size?: number;
    epochs?: number;
  }) {
    return this.fetch('/api/training', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async startTraining(configId: string) {
    return this.fetch('/api/training/execute', {
      method: 'POST',
      body: JSON.stringify({ id: configId }),
    });
  }

  async getMetrics(jobId: string) {
    return this.fetch(\`/api/training/metrics/\${jobId}\`);
  }

  async monitorTraining(jobId: string, onUpdate: (metrics: any) => void) {
    while (true) {
      const metrics = await this.getMetrics(jobId);
      onUpdate(metrics);

      if (metrics.status === 'completed' || metrics.status === 'failed') {
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// Usage
const client = new TrainingClient('https://finetunelab.ai', 'your-token');

const config = await client.createConfig({
  name: 'my-model',
  base_model: 'meta-llama/Llama-3.2-1B',
  dataset_id: 'dataset-123',
  epochs: 3,
});

const { job_id } = await client.startTraining(config.id);

await client.monitorTraining(job_id, (metrics) => {
  console.log(\`Progress: \${metrics.current_step}/\${metrics.total_steps}\`);
  console.log(\`Loss: \${metrics.train_loss}\`);
});`,
                        'js-client'
                      )}
                      className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1"
                    >
                      {copiedCode === 'js-client' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copiedCode === 'js-client' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm text-slate-100">
                      <code>{`class TrainingClient {
  constructor(baseUrl, authToken) {
    this.baseUrl = baseUrl;
    this.authToken = authToken;
  }

  async createConfig(config) {
    const response = await fetch(\`\${this.baseUrl}/api/training\`, {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${this.authToken}\`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });
    return response.json();
  }

  async getMetrics(jobId) {
    const response = await fetch(\`\${this.baseUrl}/api/training/metrics/\${jobId}\`, {
      headers: { 'Authorization': \`Bearer \${this.authToken}\` },
    });
    return response.json();
  }
}`}</code>
                    </pre>
                  </div>
                </div>
              </div>

              {/* Example 2: React Hook */}
              <div>
                <h3 className="text-xl font-semibold mb-3">React Hook for Training</h3>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold">useTraining.ts</h4>
                    <button
                      onClick={() => copyToClipboard(
`import { useState, useEffect } from 'react';

export function useTraining(jobId: string | null) {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const response = await fetch(\`/api/training/metrics/\${jobId}\`);
        const data = await response.json();
        setMetrics(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);

    return () => clearInterval(interval);
  }, [jobId]);

  return { metrics, loading, error };
}

// Usage in component
function TrainingMonitor({ jobId }: { jobId: string }) {
  const { metrics, loading, error } = useTraining(jobId);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!metrics) return null;

  return (
    <div>
      <h2>Training Progress</h2>
      <p>Step: {metrics.current_step} / {metrics.total_steps}</p>
      <p>Loss: {metrics.train_loss.toFixed(4)}</p>
      <p>Status: {metrics.status}</p>
    </div>
  );
}`,
                        'react-hook'
                      )}
                      className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1"
                    >
                      {copiedCode === 'react-hook' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copiedCode === 'react-hook' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm text-slate-100">
                      <code>{`import { useState, useEffect } from 'react';

export function useTraining(jobId) {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    if (!jobId) return;

    const fetchMetrics = async () => {
      const response = await fetch(\`/api/training/metrics/\${jobId}\`);
      setMetrics(await response.json());
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, [jobId]);

  return metrics;
}`}</code>
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* cURL Examples */}
          <section id="curl" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-green-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">🔧 cURL Command Reference</h2>
              <p className="text-muted-foreground">Quick copy-paste commands for terminal use</p>
            </div>

            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                  <h3 className="font-semibold mb-2">Create Training Config</h3>
                  <div className="bg-slate-900 dark:bg-slate-950 p-3 rounded text-xs overflow-x-auto">
                    <code className="text-slate-100">{`curl -X POST https://finetunelab.ai/api/training \\
  -H "Content-Type: application/json" \\
  -d '{"name": "my-model", "base_model": "meta-llama/Llama-3.2-1B", "dataset_id": "dataset-123", "epochs": 3}'`}</code>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                  <h3 className="font-semibold mb-2">Start Training</h3>
                  <div className="bg-slate-900 dark:bg-slate-950 p-3 rounded text-xs overflow-x-auto">
                    <code className="text-slate-100">{`curl -X POST https://finetunelab.ai/api/training/execute \\
  -H "Content-Type: application/json" \\
  -d '{"id": "config-456"}'`}</code>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                  <h3 className="font-semibold mb-2">Get Training Status</h3>
                  <div className="bg-slate-900 dark:bg-slate-950 p-3 rounded text-xs overflow-x-auto">
                    <code className="text-slate-100">{`curl https://finetunelab.ai/api/training/status/job-789`}</code>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                  <h3 className="font-semibold mb-2">Get Metrics</h3>
                  <div className="bg-slate-900 dark:bg-slate-950 p-3 rounded text-xs overflow-x-auto">
                    <code className="text-slate-100">{`curl https://finetunelab.ai/api/training/metrics/job-789`}</code>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                  <h3 className="font-semibold mb-2">Pause Training</h3>
                  <div className="bg-slate-900 dark:bg-slate-950 p-3 rounded text-xs overflow-x-auto">
                    <code className="text-slate-100">{`curl -X POST https://finetunelab.ai/api/training/pause/job-789`}</code>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                  <h3 className="font-semibold mb-2">Resume Training</h3>
                  <div className="bg-slate-900 dark:bg-slate-950 p-3 rounded text-xs overflow-x-auto">
                    <code className="text-slate-100">{`curl -X POST https://finetunelab.ai/api/training/resume/job-789`}</code>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                  <h3 className="font-semibold mb-2">Download Model</h3>
                  <div className="bg-slate-900 dark:bg-slate-950 p-3 rounded text-xs overflow-x-auto">
                    <code className="text-slate-100">{`curl -O https://finetunelab.ai/api/training/download/job-789`}</code>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                  <h3 className="font-semibold mb-2">Get Analytics</h3>
                  <div className="bg-slate-900 dark:bg-slate-950 p-3 rounded text-xs overflow-x-auto">
                    <code className="text-slate-100">{`curl https://finetunelab.ai/api/training/analytics/job-789`}</code>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Inference Deployment Examples */}
          <section id="inference-deployment" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-orange-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">🚀 Inference Deployment Examples</h2>
              <p className="text-muted-foreground">Deploy trained models to production with RunPod Serverless</p>
            </div>

            {/* Python Example */}
            <div className="mb-12">
              <h3 className="text-2xl font-semibold mb-4">Python: Complete Deployment Workflow</h3>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">deploy_inference.py</h4>
                  <button
                    onClick={() => copyToClipboard(
`import requests
import time
import json

# Configuration
API_BASE = "https://finetunelab.ai"
AUTH_TOKEN = "your-auth-token-here"

headers = {
    "Authorization": f"Bearer {AUTH_TOKEN}",
    "Content-Type": "application/json"
}

class InferenceDeployment:
    def __init__(self, api_base, auth_token):
        self.api_base = api_base
        self.headers = {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }

    def deploy(self, training_job_id, deployment_name, gpu_type="NVIDIA RTX A4000", budget_limit=10.0):
        """Deploy a trained model to RunPod Serverless"""
        url = f"{self.api_base}/api/inference/deploy"
        payload = {
            "provider": "runpod-serverless",
            "deployment_name": deployment_name,
            "training_job_id": training_job_id,
            "gpu_type": gpu_type,
            "budget_limit": budget_limit,
            "min_workers": 0,
            "max_workers": 3,
            "auto_stop_on_budget": True
        }

        response = requests.post(url, json=payload, headers=self.headers)
        response.raise_for_status()
        return response.json()

    def get_status(self, deployment_id):
        """Check deployment status and metrics"""
        url = f"{self.api_base}/api/inference/deployments/{deployment_id}/status"
        response = requests.get(url, headers=self.headers)
        response.raise_for_status()
        return response.json()

    def wait_for_active(self, deployment_id, timeout=300):
        """Wait for deployment to become active"""
        start_time = time.time()

        while True:
            if time.time() - start_time > timeout:
                raise TimeoutError(f"Deployment did not become active within {timeout}s")

            status_data = self.get_status(deployment_id)
            status = status_data["deployment"]["status"]

            print(f"Status: {status}")

            if status == "active":
                return status_data
            elif status in ["failed", "error"]:
                raise Exception(f"Deployment failed: {status_data.get('error_message')}")

            time.sleep(10)

    def make_inference_request(self, endpoint_url, prompt):
        """Make an inference request to the deployed model"""
        payload = {
            "input": {
                "prompt": prompt,
                "max_tokens": 512,
                "temperature": 0.7
            }
        }

        response = requests.post(endpoint_url, json=payload)
        response.raise_for_status()
        return response.json()

    def stop(self, deployment_id):
        """Stop a running deployment"""
        url = f"{self.api_base}/api/inference/deployments/{deployment_id}/stop"
        response = requests.delete(url, headers=self.headers)
        response.raise_for_status()
        return response.json()

# Example Usage
if __name__ == "__main__":
    client = InferenceDeployment(API_BASE, AUTH_TOKEN)

    # Step 1: Deploy model
    print("Deploying model to RunPod Serverless...")
    deployment = client.deploy(
        training_job_id="job-abc123",
        deployment_name="my-model-prod",
        gpu_type="NVIDIA RTX A4000",
        budget_limit=10.0
    )

    deployment_id = deployment["deployment_id"]
    print(f"Deployment created: {deployment_id}")

    # Step 2: Wait for deployment to become active
    print("Waiting for deployment to become active...")
    active_deployment = client.wait_for_active(deployment_id)
    endpoint_url = active_deployment["deployment"]["endpoint_url"]
    print(f"Deployment active! Endpoint: {endpoint_url}")

    # Step 3: Make inference request
    print("\\nMaking inference request...")
    result = client.make_inference_request(
        endpoint_url,
        "Explain quantum computing in simple terms"
    )
    print(f"Response: {result}")

    # Step 4: Monitor costs
    status = client.get_status(deployment_id)
    print(f"\\nCurrent spend: {'$'}{status['deployment']['current_spend']:.2f}")
    print(f"Budget utilization: {status['deployment']['budget_utilization_percent']:.1f}%")

    # Step 5: Stop deployment when done
    # print("\\nStopping deployment...")
    # client.stop(deployment_id)
    # print("Deployment stopped")`,
                      'python-inference'
                    )}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
                  >
                    {copiedCode === 'python-inference' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copiedCode === 'python-inference' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg overflow-x-auto">
                  <pre className="text-sm text-slate-100">
                    <code>{`import requests
import time

class InferenceDeployment:
    def deploy(self, training_job_id, deployment_name, budget_limit=10.0):
        url = f"{self.api_base}/api/inference/deploy"
        payload = {
            "provider": "runpod-serverless",
            "deployment_name": deployment_name,
            "training_job_id": training_job_id,
            "gpu_type": "NVIDIA RTX A4000",
            "budget_limit": budget_limit
        }
        response = requests.post(url, json=payload, headers=self.headers)
        return response.json()

    def get_status(self, deployment_id):
        url = f"{self.api_base}/api/inference/deployments/{deployment_id}/status"
        return requests.get(url, headers=self.headers).json()

    def make_inference_request(self, endpoint_url, prompt):
        payload = {"input": {"prompt": prompt, "max_tokens": 512}}
        return requests.post(endpoint_url, json=payload).json()`}</code>
                  </pre>
                </div>
              </div>
            </div>

            {/* JavaScript Example */}
            <div className="mb-12">
              <h3 className="text-2xl font-semibold mb-4">JavaScript/TypeScript: Inference Client</h3>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">InferenceClient.ts</h4>
                  <button
                    onClick={() => copyToClipboard(
`class InferenceClient {
  private baseUrl: string;
  private authToken: string;

  constructor(baseUrl: string, authToken: string) {
    this.baseUrl = baseUrl;
    this.authToken = authToken;
  }

  private async fetch(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(\`\${this.baseUrl}\${endpoint}\`, {
      ...options,
      headers: {
        'Authorization': \`Bearer \${this.authToken}\`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || \`API Error: \${response.statusText}\`);
    }

    return response.json();
  }

  async deploy(config: {
    trainingJobId: string;
    deploymentName: string;
    gpuType?: string;
    budgetLimit?: number;
    minWorkers?: number;
    maxWorkers?: number;
  }) {
    return this.fetch('/api/inference/deploy', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'runpod-serverless',
        deployment_name: config.deploymentName,
        training_job_id: config.trainingJobId,
        gpu_type: config.gpuType || 'NVIDIA RTX A4000',
        budget_limit: config.budgetLimit || 10.0,
        min_workers: config.minWorkers || 0,
        max_workers: config.maxWorkers || 3,
        auto_stop_on_budget: true,
      }),
    });
  }

  async getStatus(deploymentId: string) {
    return this.fetch(\`/api/inference/deployments/\${deploymentId}/status\`);
  }

  async waitForActive(deploymentId: string, timeoutMs: number = 300000) {
    const startTime = Date.now();

    while (true) {
      if (Date.now() - startTime > timeoutMs) {
        throw new Error(\`Deployment did not become active within \${timeoutMs}ms\`);
      }

      const statusData = await this.getStatus(deploymentId);
      const status = statusData.deployment.status;

      console.log(\`Status: \${status}\`);

      if (status === 'active') {
        return statusData;
      } else if (['failed', 'error'].includes(status)) {
        throw new Error(\`Deployment failed: \${statusData.error_message}\`);
      }

      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }

  async makeInferenceRequest(endpointUrl: string, prompt: string) {
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: {
          prompt,
          max_tokens: 512,
          temperature: 0.7,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(\`Inference request failed: \${response.statusText}\`);
    }

    return response.json();
  }

  async stop(deploymentId: string) {
    return this.fetch(\`/api/inference/deployments/\${deploymentId}/stop\`, {
      method: 'DELETE',
    });
  }
}

// Example Usage
async function main() {
  const client = new InferenceClient('https://finetunelab.ai', 'your-token');

  // Deploy model
  console.log('Deploying model...');
  const deployment = await client.deploy({
    trainingJobId: 'job-abc123',
    deploymentName: 'my-model-prod',
    gpuType: 'NVIDIA RTX A4000',
    budgetLimit: 10.0,
  });

  const deploymentId = deployment.deployment_id;
  console.log(\`Deployment created: \${deploymentId}\`);

  // Wait for active
  console.log('Waiting for deployment to become active...');
  const activeDeployment = await client.waitForActive(deploymentId);
  const endpointUrl = activeDeployment.deployment.endpoint_url;
  console.log(\`Deployment active! Endpoint: \${endpointUrl}\`);

  // Make inference request
  console.log('Making inference request...');
  const result = await client.makeInferenceRequest(
    endpointUrl,
    'Explain quantum computing in simple terms'
  );
  console.log('Response:', result);

  // Check costs
  const status = await client.getStatus(deploymentId);
  console.log(\`Current spend: {'$'}\${status.deployment.current_spend.toFixed(2)}\`);
  console.log(\`Budget utilization: \${status.deployment.budget_utilization_percent.toFixed(1)}%\`);
}

main().catch(console.error);`,
                      'js-inference'
                    )}
                    className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1"
                  >
                    {copiedCode === 'js-inference' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copiedCode === 'js-inference' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg overflow-x-auto">
                  <pre className="text-sm text-slate-100">
                    <code>{`class InferenceClient {
  async deploy(config) {
    return this.fetch('/api/inference/deploy', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'runpod-serverless',
        deployment_name: config.deploymentName,
        training_job_id: config.trainingJobId,
        gpu_type: config.gpuType || 'NVIDIA RTX A4000',
        budget_limit: config.budgetLimit || 10.0
      })
    });
  }

  async makeInferenceRequest(endpointUrl, prompt) {
    const response = await fetch(endpointUrl, {
      method: 'POST',
      body: JSON.stringify({ input: { prompt, max_tokens: 512 }})
    });
    return response.json();
  }
}`}</code>
                  </pre>
                </div>
              </div>
            </div>

            {/* cURL Examples */}
            <div className="mb-12">
              <h3 className="text-2xl font-semibold mb-4">cURL: Quick Commands</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                  <h4 className="font-semibold mb-2">Deploy to RunPod Serverless</h4>
                  <div className="bg-slate-900 dark:bg-slate-950 p-3 rounded text-xs overflow-x-auto">
                    <code className="text-slate-100">{`curl -X POST https://finetunelab.ai/api/inference/deploy \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "provider": "runpod-serverless",
    "deployment_name": "my-model-prod",
    "training_job_id": "job-abc123",
    "gpu_type": "NVIDIA RTX A4000",
    "budget_limit": 10.0,
    "min_workers": 0,
    "max_workers": 3,
    "auto_stop_on_budget": true
  }'`}</code>
                  </div>
                </div>

                <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                  <h4 className="font-semibold mb-2">Check Deployment Status</h4>
                  <div className="bg-slate-900 dark:bg-slate-950 p-3 rounded text-xs overflow-x-auto">
                    <code className="text-slate-100">{`curl -X GET \\
  https://finetunelab.ai/api/inference/deployments/dep-xyz789/status \\
  -H "Authorization: Bearer YOUR_TOKEN"`}</code>
                  </div>
                </div>

                <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                  <h4 className="font-semibold mb-2">Make Inference Request</h4>
                  <div className="bg-slate-900 dark:bg-slate-950 p-3 rounded text-xs overflow-x-auto">
                    <code className="text-slate-100">{`curl -X POST https://your-endpoint.runpod.net \\
  -H "Content-Type: application/json" \\
  -d '{
    "input": {
      "prompt": "Explain quantum computing",
      "max_tokens": 512,
      "temperature": 0.7
    }
  }'`}</code>
                  </div>
                </div>

                <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                  <h4 className="font-semibold mb-2">Stop Deployment</h4>
                  <div className="bg-slate-900 dark:bg-slate-950 p-3 rounded text-xs overflow-x-auto">
                    <code className="text-slate-100">{`curl -X DELETE \\
  https://finetunelab.ai/api/inference/deployments/dep-xyz789/stop \\
  -H "Authorization: Bearer YOUR_TOKEN"`}</code>
                  </div>
                </div>
              </div>
            </div>

            {/* Important Notes */}
            <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h4 className="font-semibold mb-2">💡 Important Notes</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Configure RunPod API key in Settings → Secrets before deploying</li>
                <li>• Minimum budget limit is $1.00, recommended $10-50 for production</li>
                <li>• Auto-scaling: Set min_workers=0 to scale to zero when idle</li>
                <li>• Budget alerts trigger at 50%, 80%, and 100% utilization</li>
                <li>• Deployment typically takes 2-5 minutes to become active</li>
                <li>• Monitor costs in real-time on the /inference page</li>
              </ul>
            </div>
          </section>

          {/* End-to-End Workflows */}
          <section id="end-to-end" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-purple-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">🔄 End-to-End Workflows</h2>
              <p className="text-muted-foreground">Complete scenarios from start to finish</p>
            </div>

            <div className="space-y-8">
              {/* Workflow 1: Basic Fine-Tuning */}
              <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h3 className="text-xl font-semibold mb-4">Workflow 1: Basic Fine-Tuning</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</div>
                    <div>
                      <p className="font-semibold">Prepare dataset (training_data.jsonl)</p>
                      <code className="text-xs bg-slate-900 text-slate-100 px-2 py-1 rounded mt-1 block">{`{"messages": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]}`}</code>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</div>
                    <div>
                      <p className="font-semibold">Upload dataset</p>
                      <code className="text-xs bg-slate-900 text-slate-100 px-2 py-1 rounded mt-1 block">POST /api/training/datasets</code>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</div>
                    <div>
                      <p className="font-semibold">Create training configuration</p>
                      <code className="text-xs bg-slate-900 text-slate-100 px-2 py-1 rounded mt-1 block">POST /api/training (learning_rate: 0.0001, batch_size: 4, epochs: 3)</code>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">4</div>
                    <div>
                      <p className="font-semibold">Start training job</p>
                      <code className="text-xs bg-slate-900 text-slate-100 px-2 py-1 rounded mt-1 block">POST /api/training/execute</code>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">5</div>
                    <div>
                      <p className="font-semibold">Monitor progress (poll every 5-10 seconds)</p>
                      <code className="text-xs bg-slate-900 text-slate-100 px-2 py-1 rounded mt-1 block">GET /api/training/metrics/:id</code>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">✓</div>
                    <div>
                      <p className="font-semibold">Download trained model</p>
                      <code className="text-xs bg-slate-900 text-slate-100 px-2 py-1 rounded mt-1 block">GET /api/training/download/:id</code>
                    </div>
                  </div>
                </div>
              </div>

              {/* Workflow 2: Production Deployment */}
              <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                <h3 className="text-xl font-semibold mb-4">Workflow 2: Production Deployment</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</div>
                    <div>
                      <p className="font-semibold">Complete training workflow (see Workflow 1)</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</div>
                    <div>
                      <p className="font-semibold">Review final metrics</p>
                      <code className="text-xs bg-slate-900 text-slate-100 px-2 py-1 rounded mt-1 block">GET /api/training/analytics/:id (check final loss, eval metrics)</code>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</div>
                    <div>
                      <p className="font-semibold">Deploy to RunPod Serverless</p>
                      <code className="text-xs bg-slate-900 text-slate-100 px-2 py-1 rounded mt-1 block">POST /api/training/deploy/:id</code>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">4</div>
                    <div>
                      <p className="font-semibold">Test deployed model</p>
                      <code className="text-xs bg-slate-900 text-slate-100 px-2 py-1 rounded mt-1 block">{`curl -X POST https://finetunelab.ai/v1/chat/completions -d '{"model": "...", "messages": [...]}'`}</code>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">5</div>
                    <div>
                      <p className="font-semibold">Add model to your app</p>
                      <code className="text-xs bg-slate-900 text-slate-100 px-2 py-1 rounded mt-1 block">POST /api/models (register custom model with base_url)</code>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">✓</div>
                    <div>
                      <p className="font-semibold">Monitor production usage</p>
                      <code className="text-xs bg-slate-900 text-slate-100 px-2 py-1 rounded mt-1 block">Track latency, error rates, user feedback</code>
                    </div>
                  </div>
                </div>
              </div>

              {/* Workflow 3: Hyperparameter Optimization */}
              <div className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                <h3 className="text-xl font-semibold mb-4">Workflow 3: Hyperparameter Optimization</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</div>
                    <div>
                      <p className="font-semibold">Create baseline config (learning_rate: 1e-4, batch_size: 4)</p>
                      <code className="text-xs bg-slate-900 text-slate-100 px-2 py-1 rounded mt-1 block">POST /api/training → config-baseline</code>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</div>
                    <div>
                      <p className="font-semibold">Create variant configs with different hyperparameters</p>
                      <code className="text-xs bg-slate-900 text-slate-100 px-2 py-1 rounded mt-1 block">POST /api/training → config-lr-high (lr: 5e-4), config-lr-low (lr: 5e-5)</code>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</div>
                    <div>
                      <p className="font-semibold">Run all training jobs in parallel</p>
                      <code className="text-xs bg-slate-900 text-slate-100 px-2 py-1 rounded mt-1 block">POST /api/training/execute for each config</code>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs font-bold">4</div>
                    <div>
                      <p className="font-semibold">Compare results</p>
                      <code className="text-xs bg-slate-900 text-slate-100 px-2 py-1 rounded mt-1 block">{`GET /api/training/analytics/compare?ids=job1,job2,job3`}</code>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">✓</div>
                    <div>
                      <p className="font-semibold">Select best performing config and deploy</p>
                      <code className="text-xs bg-slate-900 text-slate-100 px-2 py-1 rounded mt-1 block">Choose config with lowest eval loss and best convergence</code>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Summary */}
          <div className="p-6 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20 border border-green-200 dark:border-green-800 rounded-lg">
            <h2 className="text-xl font-bold mb-3">🎉 Ready to Build!</h2>
            <p className="text-muted-foreground mb-4">
              You now have working code examples in Python, JavaScript, and cURL. Pick your favorite language and start building!
            </p>
            <div className="flex gap-4">
              <a href="/docs/api-reference" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">
                View Full API Reference →
              </a>
              <a href="/docs/troubleshooting" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">
                Get Help →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
