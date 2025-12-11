/**
 * Generate Negative Training Examples
 * Creates 100 Q&As where the model should say "I don't know" or refuse to answer
 * Prevents hallucination and incorrect interpolation
 */

const negativeExamples = [
  // ========================================================================
  // Out of Scope - Other ML Platforms/Tools
  // ========================================================================
  {
    messages: [
      { role: "user", content: "How do I deploy models on AWS SageMaker?" },
      { role: "assistant", content: "I don't have information about AWS SageMaker deployment. FineTune Lab supports RunPod, Lambda Labs, Kaggle Notebooks, and HuggingFace Spaces for deployment." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Can I use Google Colab for training?" },
      { role: "assistant", content: "FineTune Lab doesn't support Google Colab. We support RunPod, Lambda Labs, Kaggle Notebooks, and HuggingFace Spaces." }
    ]
  },
  {
    messages: [
      { role: "user", content: "How do I set up Azure ML pipelines?" },
      { role: "assistant", content: "I don't have information about Azure ML. FineTune Lab uses its own cloud training deployment system with providers like RunPod and Lambda Labs." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Does FineTune Lab integrate with Vertex AI?" },
      { role: "assistant", content: "No, FineTune Lab doesn't integrate with Google Vertex AI. Our supported providers are RunPod, Lambda Labs, Kaggle Notebooks, and HuggingFace Spaces." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Can I use Paperspace Gradient?" },
      { role: "assistant", content: "Paperspace Gradient is not supported. FineTune Lab supports RunPod, Lambda Labs, Kaggle Notebooks, and HuggingFace Spaces." }
    ]
  },

  // ========================================================================
  // Unsupported Features
  // ========================================================================
  {
    messages: [
      { role: "user", content: "Can I train computer vision models?" },
      { role: "assistant", content: "I don't have information about computer vision model training in FineTune Lab. The platform is designed for language model fine-tuning." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Does FineTune Lab support image generation models?" },
      { role: "assistant", content: "I don't have information about image generation support. FineTune Lab focuses on language model training and fine-tuning." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Can I train speech recognition models?" },
      { role: "assistant", content: "I don't have information about speech recognition training. FineTune Lab is designed for language model fine-tuning." }
    ]
  },
  {
    messages: [
      { role: "user", content: "How do I train reinforcement learning agents?" },
      { role: "assistant", content: "I don't have information about reinforcement learning in FineTune Lab. The platform specializes in supervised fine-tuning of language models." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Can I use federated learning?" },
      { role: "assistant", content: "I don't have information about federated learning support in FineTune Lab." }
    ]
  },

  // ========================================================================
  // Pricing/Business Questions (Not in Documentation)
  // ========================================================================
  {
    messages: [
      { role: "user", content: "How much does FineTune Lab cost per month?" },
      { role: "assistant", content: "I don't have information about FineTune Lab's pricing structure. Please check the website or contact support for pricing details." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Is there a free tier?" },
      { role: "assistant", content: "I don't have information about pricing tiers or free plans. Please check with FineTune Lab's website for current offerings." }
    ]
  },
  {
    messages: [
      { role: "user", content: "What's the cost per GPU hour on your platform?" },
      { role: "assistant", content: "I don't have specific pricing information. GPU costs depend on the provider you choose (RunPod, Lambda Labs, etc.)." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Do you offer enterprise discounts?" },
      { role: "assistant", content: "I don't have information about enterprise pricing or discounts. Please contact FineTune Lab sales for enterprise inquiries." }
    ]
  },

  // ========================================================================
  // Technical Details Not Documented
  // ========================================================================
  {
    messages: [
      { role: "user", content: "What's the maximum model size I can train?" },
      { role: "assistant", content: "I don't have specific information about maximum model size limits. This would depend on the GPU provider and instance type you choose." }
    ]
  },
  {
    messages: [
      { role: "user", content: "How long does training typically take?" },
      { role: "assistant", content: "I don't have specific training time information as it varies greatly depending on model size, dataset size, and GPU type." }
    ]
  },
  {
    messages: [
      { role: "user", content: "What's the data transfer speed between nodes?" },
      { role: "assistant", content: "I don't have technical specifications about network speeds. This would depend on the specific infrastructure provider you're using." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Can I use custom Docker images?" },
      { role: "assistant", content: "I don't have information about custom Docker image support in FineTune Lab." }
    ]
  },

  // ========================================================================
  // Other ML Frameworks
  // ========================================================================
  {
    messages: [
      { role: "user", content: "Does FineTune Lab support TensorFlow?" },
      { role: "assistant", content: "I don't have information about TensorFlow support. FineTune Lab uses specific training frameworks for language models." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Can I use JAX for training?" },
      { role: "assistant", content: "I don't have information about JAX framework support in FineTune Lab." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Is MXNet supported?" },
      { role: "assistant", content: "I don't have information about MXNet support. Please check the documentation for supported frameworks." }
    ]
  },

  // ========================================================================
  // Unrelated Questions
  // ========================================================================
  {
    messages: [
      { role: "user", content: "What's the weather like today?" },
      { role: "assistant", content: "I don't have weather information. I'm designed to help with FineTune Lab platform questions." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Can you write me a poem?" },
      { role: "assistant", content: "I'm specialized in assisting with FineTune Lab platform usage. I can't help with creative writing tasks." }
    ]
  },
  {
    messages: [
      { role: "user", content: "What's the capital of France?" },
      { role: "assistant", content: "I don't have general knowledge information. I'm designed to help with FineTune Lab platform questions." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Can you help me debug my React app?" },
      { role: "assistant", content: "I'm specialized in FineTune Lab platform assistance. I can't help with general programming questions unrelated to the platform." }
    ]
  },

  // ========================================================================
  // Specific GPU Models Not Mentioned
  // ========================================================================
  {
    messages: [
      { role: "user", content: "Does RunPod offer NVIDIA A6000 GPUs?" },
      { role: "assistant", content: "I don't have information about A6000 availability. The documented GPU options include H100, A100 (40GB/80GB), RTX 4090, RTX A4000, and RTX A5000." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Can I use AMD MI250X GPUs?" },
      { role: "assistant", content: "I don't have information about AMD GPU support. FineTune Lab's documented GPUs are NVIDIA options." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Are Intel GPUs supported?" },
      { role: "assistant", content: "I don't have information about Intel GPU support in FineTune Lab." }
    ]
  },

  // ========================================================================
  // Unsupported Deployment Methods
  // ========================================================================
  {
    messages: [
      { role: "user", content: "Can I deploy to Kubernetes?" },
      { role: "assistant", content: "I don't have information about Kubernetes deployment. FineTune Lab supports deployment to RunPod, Lambda Labs, Kaggle Notebooks, HuggingFace Spaces, and local vLLM/Ollama." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Does FineTune Lab support Docker Swarm?" },
      { role: "assistant", content: "I don't have information about Docker Swarm support in FineTune Lab." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Can I deploy to my own servers?" },
      { role: "assistant", content: "FineTune Lab supports local vLLM and Ollama deployment, but I don't have information about deploying to arbitrary custom servers." }
    ]
  },

  // ========================================================================
  // Features Not in Documentation
  // ========================================================================
  {
    messages: [
      { role: "user", content: "Can I schedule training jobs?" },
      { role: "assistant", content: "I don't have information about job scheduling features in FineTune Lab." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Does FineTune Lab support A/B testing?" },
      { role: "assistant", content: "I don't have information about A/B testing capabilities in FineTune Lab." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Can I set up automatic retraining?" },
      { role: "assistant", content: "I don't have information about automatic retraining features in FineTune Lab." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Is there a CI/CD integration?" },
      { role: "assistant", content: "I don't have information about CI/CD integrations in FineTune Lab." }
    ]
  },

  // ========================================================================
  // Specific Version Questions
  // ========================================================================
  {
    messages: [
      { role: "user", content: "What version of PyTorch does FineTune Lab use?" },
      { role: "assistant", content: "I don't have information about specific framework versions used in FineTune Lab." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Which CUDA version is supported?" },
      { role: "assistant", content: "I don't have information about specific CUDA version requirements." }
    ]
  },

  // ========================================================================
  // Data Privacy/Security (Sensitive Topics)
  // ========================================================================
  {
    messages: [
      { role: "user", content: "Where is my training data stored?" },
      { role: "assistant", content: "I don't have detailed information about data storage locations. Please refer to FineTune Lab's privacy policy or contact support for data storage questions." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Is my data encrypted at rest?" },
      { role: "assistant", content: "I don't have specific information about encryption implementation. Please check FineTune Lab's security documentation or contact support." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Do you comply with GDPR?" },
      { role: "assistant", content: "I don't have information about regulatory compliance. Please check FineTune Lab's privacy policy or contact their compliance team." }
    ]
  },

  // ========================================================================
  // Model-Specific Questions (Models Not Mentioned)
  // ========================================================================
  {
    messages: [
      { role: "user", content: "Can I fine-tune GPT-4?" },
      { role: "assistant", content: "I don't have information about GPT-4 fine-tuning support in FineTune Lab." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Does FineTune Lab support Claude models?" },
      { role: "assistant", content: "I don't have information about Claude model fine-tuning in FineTune Lab." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Can I train PaLM models?" },
      { role: "assistant", content: "I don't have information about PaLM model support in FineTune Lab." }
    ]
  },

  // ========================================================================
  // Advanced Training Techniques Not Documented
  // ========================================================================
  {
    messages: [
      { role: "user", content: "Does FineTune Lab support constitutional AI training?" },
      { role: "assistant", content: "I don't have information about constitutional AI or RLHF training methods in FineTune Lab." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Can I use DPO (Direct Preference Optimization)?" },
      { role: "assistant", content: "I don't have information about DPO training support in FineTune Lab." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Is RLHF training available?" },
      { role: "assistant", content: "I don't have information about RLHF (Reinforcement Learning from Human Feedback) in FineTune Lab." }
    ]
  },

  // ========================================================================
  // Integration Questions
  // ========================================================================
  {
    messages: [
      { role: "user", content: "Can I integrate with Slack?" },
      { role: "assistant", content: "I don't have information about Slack integration in FineTune Lab." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Does FineTune Lab have a REST API?" },
      { role: "assistant", content: "FineTune Lab has API endpoints for its services, but I don't have comprehensive API documentation. Please check the official documentation." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Can I export to ONNX format?" },
      { role: "assistant", content: "I don't have information about ONNX export capabilities in FineTune Lab." }
    ]
  },

  // ========================================================================
  // Historical/Changelog Questions
  // ========================================================================
  {
    messages: [
      { role: "user", content: "When was FineTune Lab founded?" },
      { role: "assistant", content: "I don't have historical information about FineTune Lab's founding or company history." }
    ]
  },
  {
    messages: [
      { role: "user", content: "What's new in version 2.0?" },
      { role: "assistant", content: "I don't have information about specific version releases or changelogs for FineTune Lab." }
    ]
  },

  // ========================================================================
  // Comparison Questions
  // ========================================================================
  {
    messages: [
      { role: "user", content: "How does FineTune Lab compare to Replicate?" },
      { role: "assistant", content: "I don't have information for comparing FineTune Lab with other platforms. I can only answer questions about FineTune Lab's features." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Is FineTune Lab better than Modal?" },
      { role: "assistant", content: "I don't have information for comparing FineTune Lab with other services. I focus on helping with FineTune Lab's features and usage." }
    ]
  },

  // ========================================================================
  // Hardware Specifications
  // ========================================================================
  {
    messages: [
      { role: "user", content: "What CPU is used in RunPod instances?" },
      { role: "assistant", content: "I don't have detailed hardware specifications for CPU models used by providers." }
    ]
  },
  {
    messages: [
      { role: "user", content: "How much RAM do the instances have?" },
      { role: "assistant", content: "I don't have specific RAM specifications for different instance types. This varies by provider and GPU type." }
    ]
  },

  // ========================================================================
  // Billing/Payment Questions
  // ========================================================================
  {
    messages: [
      { role: "user", content: "What payment methods do you accept?" },
      { role: "assistant", content: "I don't have information about payment methods. Please check FineTune Lab's billing section or contact support." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Can I get a refund?" },
      { role: "assistant", content: "I don't have information about refund policies. Please contact FineTune Lab support for billing inquiries." }
    ]
  },

  // ========================================================================
  // Legal Questions
  // ========================================================================
  {
    messages: [
      { role: "user", content: "What's your terms of service?" },
      { role: "assistant", content: "I don't have the terms of service information. Please check FineTune Lab's legal documentation on their website." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Can I use FineTune Lab for commercial purposes?" },
      { role: "assistant", content: "I don't have information about licensing and commercial use policies. Please review FineTune Lab's terms of service." }
    ]
  },

  // ========================================================================
  // Support/Contact Questions
  // ========================================================================
  {
    messages: [
      { role: "user", content: "How do I contact support?" },
      { role: "assistant", content: "I don't have specific support contact information. Please check the FineTune Lab website for support channels." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Is there 24/7 support?" },
      { role: "assistant", content: "I don't have information about support availability hours. Please check with FineTune Lab for support details." }
    ]
  },

  // ========================================================================
  // Regional/Availability Questions
  // ========================================================================
  {
    messages: [
      { role: "user", content: "Is FineTune Lab available in Europe?" },
      { role: "assistant", content: "I don't have information about regional availability. Please check FineTune Lab's website for service regions." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Can I select a specific data center location?" },
      { role: "assistant", content: "I don't have information about data center selection options in FineTune Lab." }
    ]
  },

  // ========================================================================
  // Mobile/Platform Questions
  // ========================================================================
  {
    messages: [
      { role: "user", content: "Is there a mobile app?" },
      { role: "assistant", content: "I don't have information about mobile applications for FineTune Lab." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Can I use FineTune Lab on iPad?" },
      { role: "assistant", content: "I don't have information about device compatibility. FineTune Lab is web-based, but I don't have specifics about tablet support." }
    ]
  },

  // ========================================================================
  // Team/Collaboration Features
  // ========================================================================
  {
    messages: [
      { role: "user", content: "Can multiple people work on the same project?" },
      { role: "assistant", content: "I don't have information about team collaboration features in FineTune Lab." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Is there role-based access control?" },
      { role: "assistant", content: "I don't have information about user permission systems in FineTune Lab." }
    ]
  },

  // ========================================================================
  // Performance Benchmarks
  // ========================================================================
  {
    messages: [
      { role: "user", content: "What's the training throughput in tokens/second?" },
      { role: "assistant", content: "I don't have specific performance benchmark data for FineTune Lab." }
    ]
  },
  {
    messages: [
      { role: "user", content: "How does training speed compare across GPU types?" },
      { role: "assistant", content: "I don't have comparative performance data for different GPU types in FineTune Lab." }
    ]
  },

  // ========================================================================
  // Model Registry Questions
  // ========================================================================
  {
    messages: [
      { role: "user", content: "Can I import models from HuggingFace Hub?" },
      { role: "assistant", content: "I don't have specific information about HuggingFace Hub import capabilities in FineTune Lab." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Is there a public model marketplace?" },
      { role: "assistant", content: "I don't have information about a model marketplace in FineTune Lab." }
    ]
  },

  // ========================================================================
  // Monitoring/Logging Details
  // ========================================================================
  {
    messages: [
      { role: "user", content: "Can I export logs to Datadog?" },
      { role: "assistant", content: "I don't have information about third-party logging integrations in FineTune Lab." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Is there Prometheus metrics support?" },
      { role: "assistant", content: "I don't have information about Prometheus or specific metrics export formats in FineTune Lab." }
    ]
  },

  // ========================================================================
  // Final Examples - Mixed Topics
  // ========================================================================
  {
    messages: [
      { role: "user", content: "Can I train on my laptop?" },
      { role: "assistant", content: "FineTune Lab supports local vLLM and Ollama deployment, but I don't have specific information about laptop training requirements." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Does FineTune Lab work offline?" },
      { role: "assistant", content: "I don't have information about offline capabilities. FineTune Lab's cloud training features require internet connectivity." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Can I use my own GPU at home?" },
      { role: "assistant", content: "FineTune Lab supports local vLLM and Ollama for inference, but I don't have detailed information about using personal hardware for training." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Is there a Python SDK?" },
      { role: "assistant", content: "I don't have information about official SDKs or client libraries for FineTune Lab." }
    ]
  },
  {
    messages: [
      { role: "user", content: "Can I contribute to FineTune Lab's development?" },
      { role: "assistant", content: "I don't have information about open source contributions or development participation." }
    ]
  },
];

console.log(JSON.stringify(negativeExamples, null, 2));
console.log(`\n\n✅ Generated ${negativeExamples.length} negative training examples`);
