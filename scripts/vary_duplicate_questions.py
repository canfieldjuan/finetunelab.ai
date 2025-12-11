#!/usr/bin/env python3
"""
Script to vary duplicate questions in a training dataset.
Takes questions that are duplicated and rewrites them to be phrased differently
while keeping the same answer - this improves training data diversity.
"""

import json
import random

# Map of original questions to varied phrasings
# Each original question maps to a list of alternative phrasings
QUESTION_VARIATIONS = {
    # Pipeline/automation questions
    "I want to deploy a finetuning pipeline that trains nightly on new labeled data using spot instances and saves checkpoints to S3. Give me an actionable plan.": [
        "Need to set up automated model retraining every night using cheap GPU instances. What's the best architecture for this?",
        "Our data team labels new examples daily. How do I build a pipeline that automatically retrains on the fresh data without manual intervention?",
        "Looking for a cost-effective way to continuously improve my model as we collect more training data. Should I use spot instances?",
        "Can you help me design a CI/CD pipeline for ML that trains on new data each night and handles GPU preemption gracefully?",
        "What's the recommended setup for scheduled retraining jobs that won't break the bank on cloud GPU costs?",
        "Building an MLOps pipeline from scratch - need nightly training with fault tolerance and cloud storage. Where do I start?",
        "My team wants hands-off model updates. How do I automate the whole train-evaluate-deploy cycle?",
    ],

    # Cloud deployment questions
    "My config and dataset are ready. Now I need to deploy this to the cloud for training. Walk me through the cloud deployment wizard - what platforms are available, which should I choose, and how do I configure everything?": [
        "Everything is set up locally. How do I actually get this running on cloud GPUs? Which provider do you recommend?",
        "Ready to train but my laptop GPU isn't cutting it. What are my options for cloud training?",
    ],

    # RunPod model output
    "What happens to my model after RunPod training completes?": [
        "Once my RunPod job finishes, where does the trained model end up? Do I need to download it manually?",
        "Training just completed on RunPod - now what? How do I get my model?",
        "Where can I find my fine-tuned model after the RunPod pod shuts down?",
    ],

    # RunPod support
    "Does FineTune Lab support RunPod for training?": [
        "Can I use RunPod GPUs through your platform or do I need to set that up separately?",
        "Is there built-in integration with RunPod or do I have to configure it myself?",
    ],

    "Is RunPod integration available in FineTune Lab?": [
        "Does the platform have native RunPod support?",
    ],

    "Does the platform work with RunPod?": [
        "Can I connect my RunPod account to train models here?",
    ],

    # S3 mounting
    "Can I mount my S3 bucket for datasets?": [
        "Is it possible to connect my AWS S3 storage directly for training data?",
        "Can I pull datasets from my S3 bucket during training?",
    ],

    "Does the platform support S3 mounting?": [
        "Any way to use S3 as my dataset source?",
    ],

    # Checkpoints
    "Does training automatically save checkpoints?": [
        "Will my training progress be saved if something goes wrong?",
    ],

    "Will my training progress be saved automatically?": [
        "Do I need to manually configure checkpoint saving or is it automatic?",
    ],

    "Does the system create checkpoints while training?": [
        "How often does the trainer save my model during training?",
    ],

    # Resume training
    "Can I resume a failed training job?": [
        "My training crashed halfway through. Can I pick up where it left off?",
        "Training got interrupted - do I have to start over from scratch?",
        "Is there a way to continue a training run that stopped unexpectedly?",
        "Pod got preempted during training. How do I resume?",
    ],

    "What happens if my training fails mid-way?": [
        "If the GPU dies during training, do I lose all my progress?",
    ],

    "Can I continue training from where it stopped?": [
        "Training timed out. Can I restart from the last checkpoint?",
    ],

    "Is it possible to restart a failed job from the last checkpoint?": [
        "How do I recover a training job that failed partway through?",
    ],

    # GPU types
    "What GPU types are available for RunPod training?": [
        "Which GPUs can I choose from when deploying to RunPod?",
        "What are my GPU options for cloud training?",
    ],

    "What are the GPU options on RunPod?": [
        "Can you list the available GPU types and their VRAM?",
    ],

    # Pod termination
    "How do I stop a RunPod pod after training?": [
        "Do I need to manually shut down the pod when training finishes?",
        "How do I make sure I'm not charged for idle time after training completes?",
    ],

    "What happens to the pod when training finishes?": [
        "Does the RunPod instance automatically terminate or do I need to stop it?",
    ],

    # Training logs
    "Where are my training logs stored?": [
        "How do I access the logs from my training run?",
        "Where can I find detailed output from my training job?",
        "I need to debug my training - where are the logs?",
    ],

    "Where can I find my training logs?": [
        "Looking for the training output - which section has the logs?",
    ],

    # Budget
    "What happens when my budget limit is reached?": [
        "If training hits my spending cap, does it save progress before stopping?",
        "Will my training be safely terminated if I run out of budget?",
    ],

    "What's the behavior when budget runs out?": [
        "Does the system gracefully handle hitting the cost limit?",
    ],

    "Can I set a budget limit on training jobs?": [
        "Is there a way to cap how much a training run can cost?",
        "How do I prevent a runaway training job from draining my account?",
        "Can I put a spending limit on cloud training?",
    ],

    "Is there a way to cap my training costs?": [
        "How do I make sure training doesn't cost more than expected?",
    ],

    "Can I control spending on training?": [
        "What cost controls are available for training jobs?",
    ],

    # Multi-GPU
    "Does FineTune Lab support multi-GPU training?": [
        "Can I use multiple GPUs to speed up training?",
        "Is distributed training across GPUs supported?",
    ],

    "Can I train across multiple GPUs?": [
        "How do I enable multi-GPU for faster training?",
    ],

    "Does the platform support using more than one GPU?": [
        "Can I scale up to 2 or 4 GPUs for larger models?",
    ],

    # Training settings location
    "Where do I configure training settings?": [
        "Which page lets me adjust hyperparameters and training options?",
        "Where's the training configuration panel?",
        "How do I change batch size and learning rate?",
    ],

    "How do I set up my training parameters?": [
        "Where can I customize the training hyperparameters?",
    ],

    "Where are training options configured?": [
        "Looking for the settings to adjust my training run - where is that?",
    ],

    # Analytics
    "Where can I view my training analytics?": [
        "Which tab shows graphs and metrics from my training runs?",
        "How do I see loss curves and other training statistics?",
        "Where's the dashboard for monitoring training performance?",
    ],

    "Which tab shows my analytics?": [
        "Where do I find the training metrics visualization?",
        "Looking for the charts showing my model's learning progress.",
    ],

    "Where are analytics located?": [
        "How do I access the training analytics dashboard?",
    ],

    # New training job
    "Where do I start a new training job?": [
        "How do I kick off a fresh training run?",
        "Which button creates a new training job?",
    ],

    "Which section lets me create new training?": [
        "Where's the option to start training a new model?",
    ],

    "Where's the training job creation page?": [
        "How do I navigate to the page for starting a training job?",
    ],

    # Chat Portal
    "How do I access the Chat Portal?": [
        "Where can I test my model with a chat interface?",
        "Which tab has the conversation testing feature?",
        "How do I try out my trained model interactively?",
        "Where's the chat playground for testing models?",
    ],

    "Where can I test my models in chat?": [
        "Is there a built-in chat interface for testing model responses?",
    ],

    "Which tab has the chat interface?": [
        "Looking for the chat feature to test my model - where is it?",
    ],

    # Datasets
    "Where can I see my uploaded datasets?": [
        "How do I view my training data files?",
        "Which section shows all my datasets?",
        "Where's the dataset management page?",
    ],

    "How do I view my datasets?": [
        "Where can I browse and manage my uploaded training data?",
    ],

    "Which page shows uploaded data?": [
        "How do I access my dataset library?",
    ],

    # Model list
    "How do I view my model list?": [
        "Where can I see all my trained models?",
        "Which page shows my model inventory?",
        "How do I browse my fine-tuned models?",
    ],

    # Training logs view
    "Where do I find training logs?": [
        "How do I check the detailed output from a training job?",
        "Where's the log viewer for training runs?",
    ],

    "How do I view training logs?": [
        "Which section has the training job logs?",
    ],

    "Which button shows training output?": [
        "How do I see what's happening during training?",
    ],

    # Export conversations
    "Can I export conversations from the chat?": [
        "Is there a way to download my chat test sessions?",
        "How do I save conversations from the chat portal?",
        "Can I get my chat history as a file?",
    ],

    "Is it possible to download chat conversations?": [
        "Can I export my test conversations for review?",
    ],

    "Can I export my chat data?": [
        "How do I download conversations from the chat interface?",
    ],

    # Model comparison
    "How do I compare multiple models?": [
        "Is there a side-by-side comparison feature for models?",
        "Can I test two models against each other?",
    ],

    "Which feature lets me compare models?": [
        "Where's the model comparison tool?",
    ],

    "How do I access the comparison tool?": [
        "Looking for the A/B testing feature for models - where is it?",
        "How do I run a comparison between my base and fine-tuned model?",
    ],

    # API secrets
    "Where do I manage my API secrets?": [
        "How do I store my API keys securely in the platform?",
    ],

    "How do I configure API keys?": [
        "Where do I enter my RunPod and HuggingFace credentials?",
        "Which page has the API key management?",
    ],

    "Which page has secret management?": [
        "Where can I update my stored API credentials?",
    ],

    "Where can I add my credentials?": [
        "How do I input my cloud provider API keys?",
    ],

    # Archive conversations
    "Can I archive old conversations?": [
        "Is there a way to hide old chats without deleting them?",
    ],

    "Is there a way to archive chats?": [
        "Can I move old test conversations out of the main view?",
        "How do I clean up my chat history without losing it?",
    ],

    "How do I save old conversations?": [
        "What's the best way to preserve chat history?",
    ],

    "Can I move conversations to archive?": [
        "How do I archive a conversation I want to keep but not see every day?",
    ],

    # Context Inspector
    "Where do I find the Context Inspector?": [
        "How do I see what context was provided to the model?",
        "Where's the tool that shows RAG retrieval results?",
    ],

    "How do I view context details?": [
        "Which feature shows what information was retrieved for a response?",
    ],

    "Which tool shows retrieved context?": [
        "How do I debug what context my model is seeing?",
    ],

    # Knowledge graph
    "How do I add documents to the knowledge graph?": [
        "Where do I upload files for RAG?",
        "How do I feed documents into the knowledge base?",
    ],

    "Where can I upload knowledge base documents?": [
        "Which section handles document ingestion for RAG?",
    ],

    "Which button uploads documents to KGraph?": [
        "How do I get my docs into the knowledge graph?",
    ],

    # Account settings
    "Where can I see my account settings?": [
        "How do I access my profile and preferences?",
        "Where's the settings page?",
    ],

    # Document count
    "Does the UI show my document count?": [
        "Can I see how many files are in my knowledge base?",
        "Where do I check how many documents I've uploaded?",
    ],

    "Can I see how many documents I have?": [
        "Is there a counter for my knowledge base documents?",
    ],

    "Does the interface show my doc count?": [
        "Where can I see the size of my document collection?",
    ],

    # View archived
    "Can I view archived conversations?": [
        "How do I access conversations I archived earlier?",
        "Where can I find my archived chats?",
        "Is there a way to see my old archived conversations?",
        "How do I retrieve something from the archive?",
    ],

    "Can I access conversation archives?": [
        "Where's the archived conversations section?",
    ],

    # Batch size
    "What does batch_size control?": [
        "How does batch size affect my training?",
        "What should I set batch_size to and why does it matter?",
        "Can you explain the batch_size parameter?",
    ],

    "How does batch size affect training?": [
        "What happens if I increase or decrease batch size?",
    ],

    "What's the purpose of the batch_size parameter?": [
        "Why is batch size important for training?",
    ],

    # Gradient accumulation
    "What is gradient_accumulation_steps?": [
        "Can you explain gradient accumulation and when to use it?",
        "How does gradient accumulation help with limited GPU memory?",
    ],

    "How does gradient accumulation work?": [
        "What's the trick with gradient accumulation for bigger effective batch sizes?",
    ],

    # Learning rate
    "What does learning_rate control?": [
        "How do I choose the right learning rate for fine-tuning?",
        "What's a good starting learning rate and why?",
        "Can you explain how learning rate affects training?",
    ],

    "What is the learning rate parameter?": [
        "Why is learning rate so important for fine-tuning?",
    ],

    # Max length
    "What is max_length?": [
        "How do I set the maximum sequence length for training?",
        "What does the max_length parameter control?",
    ],

    "How is max_length used in training?": [
        "Does max_length affect training speed or memory?",
    ],

    # LoRA
    "Does FineTune Lab support LoRA?": [
        "Can I use LoRA adapters for efficient fine-tuning?",
        "Is parameter-efficient fine-tuning with LoRA available?",
    ],

    "Is LoRA available in the platform?": [
        "Does the system support LoRA-based training?",
    ],

    # LoRA rank
    "What is the LoRA rank parameter (r)?": [
        "How do I choose the right LoRA rank?",
        "What does the r parameter mean for LoRA?",
    ],

    "What does LoRA rank mean?": [
        "Can you explain how LoRA rank affects the adapters?",
    ],

    "How do I set the r parameter?": [
        "What's a good value for LoRA rank?",
    ],

    # Precision
    "What precision formats are supported?": [
        "Can I train in fp16 or bf16?",
        "What numeric precision options are available for training?",
    ],

    "What precision options are available?": [
        "Does the platform support mixed precision training?",
    ],

    "Can I use bfloat16?": [
        "Is bf16 training supported on your platform?",
    ],

    # Quantization
    "Can I use 4-bit quantization?": [
        "Does the platform support QLoRA with 4-bit models?",
        "Can I train quantized models to save VRAM?",
    ],

    "Does the platform support QLoRA?": [
        "Is 4-bit quantized training available?",
    ],

    # Gradient checkpointing
    "What does gradient_checkpointing do?": [
        "How does gradient checkpointing save memory?",
        "Should I enable gradient checkpointing for large models?",
    ],

    "How does gradient checkpointing help?": [
        "What's the trade-off with gradient checkpointing?",
    ],

    "What's the benefit of checkpointing gradients?": [
        "When should I turn on gradient checkpointing?",
        "Does gradient checkpointing slow down training?",
    ],

    "Should I enable gradient_checkpointing?": [
        "Is gradient checkpointing worth the speed trade-off?",
        "My model doesn't fit in VRAM - should I try gradient checkpointing?",
    ],

    # Optimizers
    "What optimizers are available?": [
        "Which optimizer should I use for fine-tuning - Adam or AdamW?",
        "What optimizer options does the platform support?",
    ],

    "Which optimizer should I use?": [
        "Is there a recommended optimizer for LoRA fine-tuning?",
    ],

    "What optimization algorithms are supported?": [
        "Can I use 8-bit Adam to save memory?",
    ],

    # LR schedulers
    "What learning rate schedulers are supported?": [
        "Can I use cosine annealing for the learning rate?",
        "What LR schedule options are available?",
    ],

    "Which scheduler types are available?": [
        "Does the platform support warmup with decay?",
    ],

    "Can I use cosine annealing?": [
        "How do I configure a cosine learning rate schedule?",
    ],

    "What lr_scheduler options exist?": [
        "Can I customize the learning rate schedule?",
    ],

    # Warmup
    "What does warmup_steps do?": [
        "Why should I use learning rate warmup?",
        "How many warmup steps should I use?",
    ],

    "What's the purpose of warmup_steps?": [
        "Does warmup help prevent training instability?",
        "Why is warmup recommended for fine-tuning?",
    ],

    "Why use a warmup period?": [
        "What happens if I skip the warmup steps?",
    ],

    # Checkpoint frequency
    "Can I control how often checkpoints are saved?": [
        "How do I change the checkpoint saving frequency?",
        "Is it possible to save checkpoints more often?",
        "Can I configure checkpoint intervals?",
    ],

    "How do I set checkpoint frequency?": [
        "What's the setting for how often to save during training?",
    ],

    # Packing
    "What is packing?": [
        "Can you explain what packing does for training efficiency?",
        "How does sequence packing work?",
    ],

    "Should I enable packing?": [
        "Is packing recommended for my training job?",
        "When should I use sequence packing?",
        "Does packing speed up training?",
    ],

    # Weight decay
    "Does weight_decay help with training?": [
        "Should I use weight decay for fine-tuning?",
        "What does weight decay do and when should I use it?",
    ],

    "What is weight_decay used for?": [
        "How does weight decay prevent overfitting?",
    ],

    # Sentiment analysis IMDB
    "I want to finetune a model for sentiment analysis on the IMDB dataset.": [
        "How do I train a sentiment classifier using IMDB movie reviews?",
        "What's the best setup for binary sentiment classification on IMDB?",
    ],

    # NER CoNLL
    "I want to finetune a model for named entity recognition on the CoNLL-2003 dataset.": [
        "How do I train a NER model to extract entities from news articles?",
        "What's the recommended approach for token classification on CoNLL-2003?",
    ],

    # Email.draft tool
    "I want to finetune a model to be better at using the email.draft tool. I have a dataset of conversations for this.": [
        "Can you help me train a model to generate proper email.draft tool calls from conversation context?",
    ],

    # CNN/DailyMail summarization
    "I want to finetune a model for summarization on the CNN/DailyMail dataset.": [
        "How should I configure training for news article summarization?",
        "What model and settings work best for abstractive summarization on news articles?",
    ],

    # NaN loss
    "I'm trying to finetune a model for sentiment analysis, but my training loss is NaN. Can you help me fix it?": [
        "My fine-tuning run shows NaN loss values. What could be causing this and how do I debug it?",
        "Training keeps failing with NaN loss after a few steps. What settings should I change?",
        "Why is my loss showing NaN during model fine-tuning and how can I prevent gradient explosion?",
    ],

    # SQuAD QA
    "I want to finetune a question answering model on the SQuAD dataset.": [
        "What's the best way to train an extractive QA model for reading comprehension?",
    ],

    # Code-to-text
    "I want to finetune a model for code-to-text generation on the CodeXGlue dataset.": [
        "How do I train a model to generate docstrings and comments from source code?",
        "What approach should I use for code summarization tasks?",
        "Can you recommend settings for training a model that explains what code does in plain English?",
    ],

    # Supabase NL2SQL
    "I want to finetune a model to query my Supabase database using natural language.": [
        "Is it possible to build a chatbot that writes PostgreSQL queries based on what users ask in plain English?",
        "My team keeps asking me to run database queries. Can I train a model so they can just type questions and get SQL?",
    ],

    # Email classification
    "I want to finetune a model to classify my emails into different categories.": [
        "My inbox is a mess. Can I train something to automatically sort emails into folders like work, personal, newsletters?",
        "Looking to automate email triage - what would it take to build a classifier for my specific email types?",
    ],

    # Noisy labels
    "I have a noisy labeled dataset for sentiment classification. How do I detect and fix label noise before finetuning?": [
        "Some of my training labels are probably wrong. Is there a way to find and clean up mislabeled examples before I waste GPU time?",
        "Got a dataset from contractors but I suspect the quality is inconsistent. How do I audit it for labeling errors?",
    ],

    # Clinical summarization
    "How should I evaluate a model for clinical note summarization where precision and harmful hallucinations are critical?": [
        "Building a medical summarizer where mistakes could hurt patients - what evaluation metrics actually matter here?",
        "Our healthcare AI needs to summarize doctor notes without making stuff up. How do we test for hallucinations?",
        "What's the safest way to validate a model that generates summaries for patient records?",
    ],

    # Mobile quantization
    "I need to reduce my model size and latency for mobile deployment. Recommend steps for quantization-aware finetuning.": [
        "Need to squeeze my model onto a phone app. What's the best way to shrink it without killing accuracy?",
    ],

    # Active learning
    "My labeled data is small. How do I set up active learning loop to pick samples for annotation?": [
        "Only have 200 labeled examples but 50k unlabeled ones. How do I decide which ones to label next for maximum impact?",
        "Labeling data is expensive. Can the model help me figure out which examples to label first?",
    ],

    # RAG assistant
    "I want to finetune a conversational assistant with RAG using my product docs. How should I prepare training pairs?": [
        "Building a support chatbot that pulls from our knowledge base. What format should my training examples be in?",
        "Got 500 pages of documentation. How do I turn that into training data for a retrieval-augmented chatbot?",
    ],

    # Safety/refusal
    "I need to ensure my model refuses harmful requests and cites sources for facts. What training signals should I include?": [
        "Don't want my model making up facts or helping with dangerous stuff. How do I bake safety into the training?",
        "Our legal team wants the model to say no to certain requests and always show where it got info from. How?",
    ],

    # Data drift
    "How do I detect data drift after deployment and trigger a retrain?": [
        "Model was great at launch but seems to be getting worse over time. How do I know when to retrain?",
        "Users started asking different types of questions than before. Is there a way to automatically detect this shift?",
        "Want to set up monitoring so I get alerted when production data no longer matches what the model was trained on.",
    ],

    # Contract summarization
    "Create a summary of this contract clause limited to 3 sentences and highlight any obligations and deadlines.": [
        "Need a model that can condense legal text to exactly 3 sentences and pull out the important dates and requirements.",
        "Lawyers want a tool that summarizes contract sections in bullet points with deadlines highlighted. How complex is this to train?",
    ],

    # Buggy code fix
    "I have a buggy Python function that fails on edge cases. Can you finetune a model to propose minimal fixes and corresponding unit tests?": [
        "Thinking of training a model that looks at broken code and suggests both the fix and test cases. Feasible?",
    ],

    # Cross-lingual transfer
    "I have English training data and want to adapt to Spanish and Portuguese with limited labels. What transfer strategy should I use?": [
        "Got great results in English but need to support Spanish and Portuguese with barely any labeled data in those languages.",
        "Expanding to Latin American markets soon. Can I bootstrap Spanish/Portuguese models from my existing English training data?",
    ],

    # Additional common duplicates
    "Can I switch between different training methods like SFT and DPO without starting over?": [
        "Is it possible to try different training approaches without recreating my whole config?",
    ],

    "What's the benefit of using 4-bit or 8-bit quantization?\n\nDoes quantization affect model quality?": [
        "Will quantization hurt my model's performance much? Is it worth the memory savings?",
    ],

    "I have datasets in different formats - do I need to convert them all to match?": [
        "My training data is in CSV but examples show JSONL. Do I need to convert?",
    ],

    "Can I pause a training run and resume it later without losing progress?": [
        "Something came up and I need to stop training. Can I pick it back up later?",
    ],

    "How do I know which checkpoint is the best one to use?": [
        "Training saved multiple checkpoints - how do I tell which one performs best?",
    ],

    "I'm worried about unexpected cloud bills. How can I control costs?\n\nWhat happens if training takes longer than expected?": [
        "How do I prevent a runaway training job from costing a fortune?",
    ],

    "Can I use different cloud providers or am I locked into one?": [
        "Is it possible to switch between RunPod and other providers?",
    ],

    "How can I verify my learning rate scheduler is working correctly?": [
        "How do I check that my LR schedule is being applied during training?",
    ],

    "How do I compare the performance of different hyperparameter settings?": [
        "What's the best way to run hyperparameter experiments and track results?",
    ],

    "Why do my metrics update instantly instead of requiring page refreshes?": [
        "How does the dashboard show real-time training metrics without refreshing?",
    ],

    "Can I see detailed logs without downloading files or opening SSH?": [
        "Is there a way to view training logs directly in the browser?",
    ],

    "My training costs suddenly spiked. How do I find out why?": [
        "Something caused my cloud bill to jump - how do I diagnose what happened?",
    ],

    # Additional variations for remaining duplicates
    "How often should I save checkpoints?": [
        "What's a good checkpoint frequency during training?",
        "Should I save checkpoints every epoch or more frequently?",
        "How many steps between checkpoint saves is optimal?",
        "What checkpoint interval do you recommend?",
    ],

    "Does the platform support A/B testing models?": [
        "Can I compare two model versions side by side with real traffic?",
        "Is there built-in support for testing different models against each other?",
        "How do I set up A/B tests between my base model and fine-tuned version?",
    ],

    "When should I use QLoRA?": [
        "What scenarios is QLoRA best suited for?",
        "Is QLoRA better than regular LoRA for my use case?",
        "When does 4-bit quantized LoRA make sense?",
    ],

    "What batch size should I use?": [
        "How do I pick the right batch size for my model and GPU?",
        "Is there a recommended batch size for fine-tuning?",
        "What batch size works best with limited VRAM?",
    ],

    "When should I enable gradient checkpointing?": [
        "Do I need gradient checkpointing for my training setup?",
        "Is gradient checkpointing necessary for fine-tuning large models?",
        "What triggers the need for gradient checkpointing?",
    ],

    "How many training examples do I need?": [
        "What's the minimum dataset size for effective fine-tuning?",
        "Is 100 examples enough or do I need thousands?",
        "How much training data should I collect before fine-tuning?",
    ],

    "What structure should JSONL training data have?": [
        "What format does the training data need to be in?",
        "Can you show me an example of proper JSONL training data?",
    ],

    "Does the platform track GPU hours?": [
        "Can I see how much GPU time my training jobs have used?",
        "Is there a way to monitor GPU usage across my runs?",
    ],

    "Does FineTune Lab support custom dashboards?": [
        "Can I create my own custom analytics views?",
        "Is there a way to customize what metrics I see on the dashboard?",
    ],

    "After training completes, what happens to the trained model?": [
        "Where does my model end up after the training job finishes?",
        "How do I access my trained model once training is done?",
    ],

    "Does FineTune Lab support multi-modal models?": [
        "Can I train models that handle both text and images?",
        "Are vision-language models supported on the platform?",
    ],

    "Why is my model not learning?": [
        "My loss isn't decreasing - what could be wrong?",
        "The model seems stuck and not improving. How do I debug this?",
    ],

    "Can I create synthetic training data?": [
        "Does the platform help generate additional training examples?",
        "Is there a way to augment my dataset with synthetic data?",
    ],

    "Can I import existing knowledge bases?": [
        "How do I bring in documents from another knowledge management system?",
        "Can I migrate my existing document collection to the platform?",
    ],

    "How long should I train?": [
        "How many epochs are typically needed for fine-tuning?",
        "When do I know my model has trained enough?",
    ],

    "What's the best optimizer for fine-tuning?": [
        "Which optimizer is recommended for LoRA fine-tuning?",
        "Should I use Adam, AdamW, or something else?",
    ],

    "What's a good starting learning rate?": [
        "What learning rate should I try first for fine-tuning?",
        "Is there a recommended initial learning rate?",
    ],

    "Can I edit previous messages?": [
        "Is it possible to modify earlier messages in a conversation?",
        "Can I fix a typo in a message I already sent?",
    ],

    "How many warmup steps?": [
        "What's a good number of warmup steps for my training?",
        "How do I decide on the warmup_steps value?",
    ],

    "Does FineTune Lab show training ETA?": [
        "Can I see an estimated time remaining for my training job?",
        "Does the platform predict when training will finish?",
    ],

    "Does FineTune Lab save chat history?": [
        "Are my conversations in the chat portal saved automatically?",
        "Will I lose my test conversations if I close the browser?",
    ],

    "Does GraphRAG provide citations?": [
        "Can the RAG system show me which documents it used for an answer?",
        "Will I see source references when using knowledge retrieval?",
    ],

    "What's a good weight decay value?": [
        "What weight_decay setting should I use for fine-tuning?",
        "Is there a recommended weight decay for preventing overfitting?",
    ],

    "Which models work best for instruction tuning?": [
        "What base models are recommended for instruction fine-tuning?",
        "Are some models better suited for chat/instruction formats?",
    ],

    "Can I adjust temperature during chat?": [
        "Is it possible to change the model's creativity/randomness in chat?",
        "Can I make responses more or less deterministic while testing?",
    ],

    "What's the difference between LoRA and full fine-tuning?": [
        "Should I use LoRA or train all the model parameters?",
        "When is full fine-tuning better than LoRA adapters?",
    ],

    "Does the platform support pipeline parallelism?": [
        "Can I split a large model across multiple GPUs using pipeline parallelism?",
        "Is model parallelism available for huge models?",
    ],

    "Can I see token-level predictions?": [
        "Is there a way to inspect individual token probabilities?",
        "Can I view the logits or token-by-token output?",
    ],

    "Does the platform support knowledge distillation?": [
        "Can I train a smaller model to mimic a larger one?",
        "Is teacher-student distillation training supported?",
    ],

    "What precision is recommended for training?": [
        "Should I use fp16, bf16, or fp32 for training?",
        "What numeric precision gives the best speed/quality tradeoff?",
    ],

    "What scheduler should I use?": [
        "Which learning rate scheduler works best for fine-tuning?",
        "Is cosine or linear decay better for my training?",
    ],

    "What metrics are tracked in Analytics?": [
        "What training statistics can I monitor in the analytics tab?",
        "Which metrics does the platform automatically record?",
    ],

    "Can I see training history for a model?": [
        "Is there a way to view all past training runs for a specific model?",
        "Can I look back at previous training attempts?",
    ],

    "Does FineTune Lab support regex validation?": [
        "Can I validate model outputs against regular expression patterns?",
        "Is there pattern matching for output validation?",
    ],

    "Does FineTune Lab show model size?": [
        "Can I see how many parameters my model has?",
        "Does the platform display model size information?",
    ],

    "Can I use my own judge model?": [
        "Can I customize which model is used for automatic evaluation?",
        "Is it possible to bring my own evaluation model?",
    ],

    "Can I see tokenization statistics?": [
        "Does the platform show how my text is being tokenized?",
        "Can I view token counts and distribution?",
    ],

    "Does the platform support team settings?": [
        "Can multiple team members collaborate with shared settings?",
        "Is there team management functionality?",
    ],

    "Can I train on code datasets?": [
        "Does the platform support fine-tuning for code generation?",
        "Can I use programming code as training data?",
    ],

    "Can I re-evaluate past predictions?": [
        "Is it possible to run evaluation again on previous model outputs?",
        "Can I score old predictions with new criteria?",
    ],

    "Can I reduce memory usage?": [
        "My training is running out of VRAM - what can I do?",
        "What options help lower memory consumption during training?",
    ],

    "Does the platform support vector search on graphs?": [
        "Can I do similarity search within the knowledge graph?",
        "Is semantic search available on graph nodes?",
    ],

    "Can I create custom validation rules?": [
        "Is it possible to define my own output validators?",
        "Can I add custom checks for model responses?",
    ],

    "Does the platform optimize for throughput?": [
        "Is the system designed to maximize training speed?",
        "Are there throughput optimization features?",
    ],

    "Can I filter analytics by date range?": [
        "Is it possible to view analytics for a specific time period?",
        "Can I select a date range for the metrics dashboard?",
    ],

    "Can I disable validators temporarily?": [
        "Is there a way to turn off validation checks while testing?",
        "Can I skip validation for specific runs?",
    ],

    "Does the platform support zero-shot evaluation?": [
        "Can I evaluate models without any fine-tuning?",
        "Is there support for testing base model capabilities?",
    ],

    "Can I download my training logs?": [
        "Is it possible to export logs from a training run?",
        "How do I save my training logs locally?",
    ],

    "Can I merge LoRA adapters?": [
        "Is it possible to combine multiple LoRA adapters?",
        "Can I merge my adapter back into the base model?",
    ],

    "Does FineTune Lab support custom evaluation metrics?": [
        "Can I define my own metrics for model evaluation?",
        "Is it possible to add custom scoring functions?",
    ],

    "Can I see cost breakdown by model?": [
        "Is there a way to see how much each model cost to train?",
        "Can I view spending per model?",
    ],

    "Can I see graph statistics?": [
        "Does the platform show metrics about my knowledge graph?",
        "Can I view stats like node count and edge count?",
    ],

    "What does 'role alternation error' mean?": [
        "I'm getting a role alternation error - what's wrong with my data?",
        "How do I fix role alternation issues in my training data?",
    ],

    "Can I recover from a failed training?": [
        "If my training crashes, can I restore from checkpoint?",
        "Is there automatic recovery from training failures?",
    ],

    "Does the platform check for toxic content?": [
        "Is there content moderation for training data?",
        "Can the platform detect harmful content in my dataset?",
    ],

    "Does the platform detect hallucinations?": [
        "Can the system identify when the model makes things up?",
        "Is there hallucination detection for model outputs?",
    ],

    "Can I compare models side-by-side?": [
        "Is there a visual comparison tool for multiple models?",
        "Can I see outputs from two models next to each other?",
    ],

    "Can I share models with teammates?": [
        "Is it possible to give colleagues access to my trained models?",
        "Can I share model access within my team?",
    ],

    "Does the platform calculate inter-rater agreement?": [
        "Can I measure agreement between multiple human evaluators?",
        "Is there support for computing inter-annotator metrics?",
    ],

    "Can I see error distributions?": [
        "Does the platform show breakdown of error types?",
        "Can I visualize what kinds of mistakes my model makes?",
    ],

    "Does thumbs down require a reason?": [
        "When I give negative feedback, do I have to explain why?",
        "Is a reason mandatory for thumbs down ratings?",
    ],

    "Does the platform support early stopping?": [
        "Can training automatically stop when the model stops improving?",
        "Is there automatic early stopping based on validation loss?",
    ],

    "Can I update the knowledge graph from chat?": [
        "Is it possible to add information to the knowledge base during conversation?",
        "Can I extend the graph while chatting?",
    ],

    "Does the platform help debug learning issues?": [
        "Are there debugging tools for when training goes wrong?",
        "Can the platform diagnose why my model isn't learning?",
    ],

    "Can I compare training runs?": [
        "Is there a way to compare metrics across different training jobs?",
        "Can I see side-by-side training run comparisons?",
    ],

    "Can I add evaluation tags to predictions?": [
        "Is it possible to label or tag model outputs for analysis?",
        "Can I categorize predictions for later review?",
    ],

    "Does the platform show checkpoint progress?": [
        "Can I see which checkpoints have been saved during training?",
        "Is there a progress indicator for checkpoint saving?",
    ],

    "Can I filter logs by severity?": [
        "Is it possible to show only errors or warnings in logs?",
        "Can I filter out info messages and see just problems?",
    ],

    "Can I debug tokenization issues?": [
        "Is there a tool to troubleshoot tokenization problems?",
        "Can I inspect how text is being tokenized?",
    ],

    "Can I track data drift?": [
        "Does the platform detect when input distributions change?",
        "Is there monitoring for data drift in production?",
    ],

    "Does the LLM Judge System use GPT-4 or Claude?": [
        "Which LLM powers the automatic evaluation system?",
        "What model is used for LLM-as-judge evaluation?",
    ],

    "Why is my training stuck?": [
        "My training job seems frozen - how do I troubleshoot?",
        "Training isn't progressing. What should I check?",
    ],
}


def load_duplicates(filepath):
    """Load the duplicates JSONL file."""
    entries = []
    with open(filepath, 'r') as f:
        for line in f:
            entries.append(json.loads(line.strip()))
    return entries


def get_variation(original_question, used_variations):
    """Get a varied version of the question that hasn't been used yet."""
    if original_question not in QUESTION_VARIATIONS:
        # No variations defined - create a simple paraphrase marker
        return None

    available = QUESTION_VARIATIONS[original_question]

    # Find one we haven't used yet
    for variation in available:
        if variation not in used_variations:
            used_variations.add(variation)
            return variation

    # All used - return None to keep original
    return None


def vary_questions(entries):
    """Vary the questions in the entries."""
    used_variations = set()
    varied_entries = []
    unchanged_count = 0
    varied_count = 0

    for entry in entries:
        original_question = entry['messages'][0]['content']
        variation = get_variation(original_question, used_variations)

        if variation:
            # Create new entry with varied question
            new_entry = {
                'messages': [
                    {'role': 'user', 'content': variation},
                    entry['messages'][1]  # Keep same answer
                ]
            }
            varied_entries.append(new_entry)
            varied_count += 1
        else:
            # Keep original if no variation available
            varied_entries.append(entry)
            unchanged_count += 1

    return varied_entries, varied_count, unchanged_count


def save_varied(entries, filepath):
    """Save the varied entries to JSONL."""
    with open(filepath, 'w') as f:
        for entry in entries:
            f.write(json.dumps(entry) + '\n')


def main():
    input_file = '/home/juan-canfield/Desktop/web-ui/output/finetuning_expert_duplicates.jsonl'
    output_file = '/home/juan-canfield/Desktop/web-ui/output/finetuning_expert_duplicates_varied.jsonl'

    print("Loading duplicates...")
    entries = load_duplicates(input_file)
    print(f"Loaded {len(entries)} duplicate entries")

    print("\nVarying questions...")
    varied_entries, varied_count, unchanged_count = vary_questions(entries)

    print(f"\nResults:")
    print(f"  - Varied: {varied_count}")
    print(f"  - Unchanged (no variation defined): {unchanged_count}")

    print(f"\nSaving to {output_file}...")
    save_varied(varied_entries, output_file)

    print("\nDone! Review the output file before appending to the main dataset.")
    print(f"\nTo append: cat {output_file} >> /home/juan-canfield/Desktop/web-ui/output/finetuning_expert_unique.jsonl")


if __name__ == '__main__':
    main()
