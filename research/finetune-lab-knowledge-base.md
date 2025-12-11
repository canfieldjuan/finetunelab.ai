# FineTune Lab Platform Knowledge Base

## For Multi-Turn SFT Training Data Generation

You are generating training data for Atlas, an AI assistant that helps users with FineTune Lab, an ML training and evaluation platform.

---

# CRITICAL: WHAT TO EXCLUDE

DO NOT include specific claims about:

- **Training costs** (no dollar amounts like "$500 for training")
- **Training times** (no "takes 2 hours" or "finish in 3 days")
- **Hardware requirements** (no "needs 24GB VRAM" or "use H100")
- **Dataset size recommendations** (no "50GB dataset" or "need 10k examples")
- **Model size limitations** (no "70B model requires...")
- **GPU pricing** (no "$3/hour for A100")
- **Token throughput** (no "3000 tokens/sec")

focus on:

- **How to USE FineTune Lab features** (UI workflows, buttons, panels)
- **What features EXIST** (monitoring, analytics, batch testing, etc.)
- **Qualitative guidance** ("monitor your eval loss", "use checkpoints to compare")
- **Platform workflows** ("go to Evaluation tab, click Compare Models")
- **Feature benefits** (what the feature helps you accomplish)

---

# FINETUNE LAB FEATURES

CLOUD TRAINING FEATURES
One-click RunPod deployment

What it does: Train on cloud GPUs without any infrastructure setup or devops work. The platform handles provisioning, configuration, and startup so users only think about their training job.

User experience: Users click Deploy to RunPod, pick their training configuration, and the system automatically provisions hardware, sets up the environment, installs dependencies, and launches the job. No SSH keys, Docker builds, driver installs, or manual node management.

Real-time cost tracking

What it does: Provide transparent, up-to-the-minute visibility into training costs so users always know what they are spending.

User experience: The dashboard shows current spend, cost per hour, and projected total cost based on current job progress. Users can set budget alerts and auto-pause limits so they get notified and protected before costs spike.

Auto-stop on budget

What it does: Enforce hard budget caps so users never wake up to an unexpected $500+ bill.

User experience: When creating a job, users set a maximum budget (for example, $50 or 10 hours). The system automatically pauses or stops the job when that limit is reached and records the final state so the job can be resumed later if desired.

Multi-cloud support (RunPod, AWS, GCP, Azure)

What it does: Let users choose the best price/performance mix across multiple cloud providers while keeping the same workflow.

User experience: Users select RunPod, AWS, GCP, or Azure from a provider dropdown. The system deploys into the selected provider with a consistent UI, job lifecycle, and monitoring experience across all clouds.

GPU selection interface

What it does: Help users select the right GPU type based on VRAM, compute capability, and cost instead of guessing.

User experience: The setup panel lists available GPUs with specs (VRAM, compute, generation) and estimated hourly costs. Users can compare options (e.g., A10 vs A100 vs H100) and choose the GPU that matches their model size and budget.

Checkpoint auto-save

What it does: Protect training progress so failures or interruptions don’t force users to restart from scratch.

User experience: Training jobs automatically save checkpoints at configurable intervals (by steps, epochs, or time). If a job fails, is preempted, or hits a budget limit, users can resume from the last checkpoint with a single action.

Storage mounting

What it does: Give jobs direct access to large datasets stored in cloud buckets without re-uploading them each time.

User experience: Users connect cloud storage (e.g., S3, GCS) and mount buckets directly into their training jobs. Multiple runs can reuse the same mounted datasets, eliminating repeated uploads and speeding up experiment setup.

MONITORING FEATURES
Live loss visualization

What it does: Show training and validation loss in real-time so users can detect divergence or stalled learning quickly.

User experience: The monitoring dashboard displays live-updating loss curves. Users see train and validation loss on the same chart, watch how they evolve over time, and stop or adjust runs early when behavior looks wrong.

GPU utilization graphs

What it does: Reveal how effectively GPUs are being used, helping users spot underutilization and bottlenecks.

User experience: Time-series graphs show GPU utilization, memory usage, and temperature. Users can tell if GPU usage is low and whether CPU, data loading, or I/O is throttling performance.

Memory usage tracking

What it does: Make GPU memory pressure visible so users can prevent out-of-memory crashes.

User experience: The UI shows allocated and reserved GPU memory in real-time. When usage nears the limit, warnings appear so users can reduce batch size, sequence length, or model size before the job fails.

Throughput monitoring

What it does: Quantify training efficiency using objective throughput metrics.

User experience: Tokens per second and samples per second are shown as time series and summarized per run. Users can see how throughput changes when they adjust batch size, sequence length, or data pipeline settings and pick the configuration that runs fastest.

Learning rate schedule

What it does: Make it obvious whether learning rate warmup, plateaus, and decay are happening at the intended times.

User experience: The UI overlays the learning rate schedule on the same timeline as the loss curves. Users see when warmup starts and ends, when decay kicks in, and whether those phases align with changes in loss and stability.

Terminal monitor

What it does: Provide SSH-like visibility into job logs directly in the browser.

User experience: Each job page includes an embedded terminal-style view that streams stdout, stderr, and process logs. Users can tail logs, read debug prints, and inspect errors without opening a separate SSH session.

Log streaming

What it does: Enable real-time debugging without downloading log files manually.

User experience: Logs stream into the UI with scrolling, filtering, and keyword search. Users can filter by level, search for ERROR or WARNING, and jump directly to relevant sections while the job is still running.

ANALYTICS FEATURES
Model performance comparison

What it does: Turn many individual runs into a structured, comparable view of model performance.

User experience: Runs are grouped and compared using tables and charts. Users can sort and filter by metrics such as accuracy, perplexity, latency, or custom scores to quickly identify the best-performing models and configurations.

Cost tracking charts

What it does: Visualize spending patterns and highlight when costs spike.

User experience: Spend over time is displayed as line or bar charts and can be broken down by project, model, environment, or team. Users can click into peaks to see which jobs and configs generated the extra cost.

A/B testing

What it does: Provide statistically grounded comparisons between model variants instead of gut-based decisions.

User experience: A/B experiments show side-by-side metrics for variants along with confidence intervals and significance indicators. Users can see which variant is better and how strong the evidence is.

Anomaly detection

What it does: Automatically detect unusual behavior in metrics before users notice problems manually.

User experience: The system flags anomalies such as sudden latency spikes, error bursts, or quality drops and marks them on time-series charts. Users can click anomalies to see context, related logs, and impacted runs.

Benchmark tracking

What it does: Track model performance on internal and external benchmarks across versions.

User experience: Benchmark scores are logged per model version and plotted over time. Users can see whether new releases improve, regress, or stay flat on key tasks.

Trace visualization

What it does: Break down end-to-end request latency into individual components.

User experience: Request traces show timing for steps like prompt construction, model calls, post-processing, and external API calls. Users can identify which segment is slow and prioritize optimizations there.

REPORTING FEATURES
Conversation export

What it does: Let teams export their conversation data in a structured, reusable format.

User experience: Users can export conversations including user and assistant turns, timestamps, IDs, and metadata. They can filter by date range, tags, or projects to export exactly the subset they need.

Analytics export

What it does: Turn in-product analytics views into shareable artifacts.

User experience: Charts and metric tables can be exported as PDFs, images, or raw data files. Users can drop them into slide decks, documents, or internal reports without rebuilding charts.

CSV exports

What it does: Enable quick analysis in spreadsheets and BI tools.

User experience: Metrics, run metadata, and aggregated stats can be downloaded as CSV. Users open them in Excel, Google Sheets, or BI tools and build their own pivots, charts, or dashboards.

JSON exports

What it does: Provide machine-readable exports for programmatic pipelines.

User experience: Users can export raw events, metrics, and configuration objects as JSON. Engineering or data teams feed these into ETL pipelines, warehouses, or custom analysis scripts.

Executive reports

What it does: Automatically generate high-level summaries suitable for leadership.

User experience: The system compiles key KPIs, trends versus previous periods, and notable incidents into an executive-style report. Users get a concise overview without assembling slides or reports manually.

Training package download

What it does: Make training runs portable and reproducible outside of FineTune Lab.

User experience: Users download a training package that includes configuration, scripts, and necessary metadata. This package can be run in other environments (on-prem, another cloud, CI) while reproducing the same run.

Checkpoint download

What it does: Let users retrieve any intermediate model state from a training run.

User experience: From the checkpoint list, users can download specific checkpoints along with metrics at that training step. This enables deploying intermediate models, running offline evals, or branching new training from a desired point.

CHAT PORTAL TESTING FEATURES
Instant post-training testing

What it does: Allow immediate, interactive testing of newly trained models.

User experience: As soon as a training run completes, users open the chat portal, select the new model, and send real prompts. They can quickly sanity-check behavior without a separate deployment step.

One-click model switching

What it does: Make it trivial to compare base and fine-tuned models on the same prompts.

User experience: Inside the chat UI, users pick models from a selector. They can switch between base and fine-tuned variants with one click and resend the same prompt to compare responses.

Model capability badges

What it does: Communicate which advanced features each model supports.

User experience: Each model is labeled with capability badges such as Streaming, Tools, Vision, or JSON mode. Users glance at the chat header and immediately know what they can and cannot do with that model.

Response time tracking

What it does: Surface latency issues during testing before models go to production.

User experience: Every chat response displays response latency, and the portal shows a small latency history graph. Users see if latency is stable or drifting and correlate spikes with prompts or models.

Token usage per message

What it does: Expose cost-related details for every chat interaction.

User experience: Each message shows prompt tokens, completion tokens, total tokens, and cost estimates. Users learn which prompts are expensive and can adjust prompt length or model selection accordingly.

MODEL COMPARISON LAB FEATURES
Side-by-side A/B (2–4 models)

What it does: Let users compare multiple models on the exact same test prompts.

User experience: Users enter prompts once, and the lab shows responses from 2–4 models in a grid. Each column is a model and each row is a test prompt, making qualitative comparison straightforward.

Multi-axis rating (clarity/accuracy/conciseness/overall)

What it does: Capture detailed human judgments across multiple quality dimensions.

User experience: Evaluators rate each response for clarity, accuracy, conciseness, and overall quality. The system aggregates ratings into averages, distributions, and summaries per model and per axis.

Prefer/Reject voting

What it does: Turn human preferences into structured signals for preference training (e.g., DPO).

User experience: For each prompt, users mark one response as preferred and others as rejected. These decisions are stored together with the prompt and responses, forming a reusable preference dataset.

Export as JSONL preference data

What it does: Provide training-ready preference files in a standard format.

User experience: Users export comparisons as JSONL, where each row contains prompt, chosen, and rejected fields. For example, 50 comparisons produce 50 JSONL records directly usable for preference-based training.

EVALUATION & FEEDBACK FEATURES
Thumbs up/down

What it does: Collect lightweight feedback on response quality at scale.

User experience: Each model response has thumbs up/down buttons. A single click logs the user judgment and aggregates into quality metrics over time for each model and use case.

Detailed evaluation modal

What it does: Capture structured reasons for why a response is good or bad.

User experience: Clicking Evaluate opens a modal where users can tag issues (e.g., hallucination, incomplete, off-topic) or confirm strengths. These tags are stored alongside the prediction.

7 failure tag categories

What it does: Quantify how responses fail so teams can prioritize the right fixes.

User experience: The evaluation modal exposes seven standardized failure categories. Analytics views aggregate tags into counts and percentages (e.g., “40% hallucinations,” “20% incomplete”), revealing the dominant failure modes.

Groundedness scoring

What it does: Measure how well responses stay grounded in provided context (especially for RAG).

User experience: For context-dependent responses, the system computes a groundedness score and displays it per answer or per dataset. Low scores point to hallucination or weak use of context.

Citation validation

What it does: Automatically check whether citations actually match their sources.

User experience: The system compares cited passages or references against underlying documents or graph nodes. It flags incorrect citations and highlights mismatches so users can see where the model is fabricating references.

LLM JUDGE SYSTEM FEATURES
LLM-as-Judge (GPT-4/Claude)

What it does: Use stronger external models to score large sets of responses automatically.

User experience: Users configure a judge model and evaluation rubric. For each candidate response, the system sends the prompt and answer to the judge, then stores returned scores and short rationales.

5-criterion framework

What it does: Standardize evaluation around five core dimensions: Helpful, Accurate, Clear, Safe, and Complete.

User experience: The judge scores each response on these five criteria. Dashboards aggregate these scores over runs, tasks, and models so teams can compare performance along each dimension.

Validator Breakdown view

What it does: Show which automated checks a response passes or fails.

User experience: In the Validator Breakdown view, users see a table listing each validator with pass/fail status and explanations of failures. This makes it clear why the overall score looks the way it does.

RULE-BASED VALIDATORS
No-hallucination validator

What it does: Detect factual inconsistencies between responses and trusted context.

User experience: The validator compares response content against ground truth or provided documents. When it finds contradictions or fabrications, it flags the response and highlights specific hallucinated spans.

Required elements validator

What it does: Ensure responses always include key content required by the task.

User experience: Users define required elements such as mandatory phrases, sections, or fields. The validator checks each response and reports which elements are present or missing, enabling stricter quality guarantees.

Format compliance validator

What it does: Confirm that responses follow required output formats for downstream systems.

User experience: For structured outputs like JSON, XML, or markdown, the validator parses the response and validates structure, required fields, and types. It surfaces syntax errors or missing fields with clear error messages.

BATCH TESTING FEATURES
Bulk prompt upload

What it does: Run large test suites of prompts in a single operation.

User experience: Users upload prompts as CSV or JSONL (optionally with expected outputs or labels). The system processes them in parallel and returns a downloadable report with results, scores, and logs.

Automated regression suite

What it does: Prevent regressions by automatically re-running tests against new model versions.

User experience: Users define regression suites representing important behaviors. Whenever a new model version is added, the suite runs automatically and shows pass/fail results, highlighting any newly failing cases.

Parallel execution

What it does: Shorten evaluation time by running many tests simultaneously.

User experience: Batch tests are distributed across workers. The UI shows a progress bar and partial results as they complete, then a final summary plus detailed per-prompt results when the slowest test finishes.

PREDICTIONS TRACKING FEATURES
Conversation history

What it does: Maintain a durable audit trail of all model interactions.

User experience: The Predictions tab lists past interactions as a searchable, filterable table with timestamps, users (where available), models, and outcomes. Users can open individual records to see full prompts, responses, and metadata.

Searchable predictions

What it does: Make it easy to find specific past interactions or test cases.

User experience: Users search by keyword, filter by date range, model, tag, or outcome, and sort by latency or error code. This helps rediscover important examples, incidents, or edge cases for review.

Prediction export

What it does: Allow prediction logs to be analyzed in external tools.

User experience: Users can export selected or filtered predictions as CSV or JSON. These exports include prompts, responses, metadata, and IDs so teams can join them with other datasets or run deeper analyses.

GRAPHRAG CONTEXT FEATURES
Knowledge graph integration

What it does: Ground responses in a structured knowledge graph instead of unstructured text only.

User experience: FineTune Lab connects to external or internal graphs. Responses reference graph entities, and users can visualize relationships to understand how an answer is supported by graph structure.

Context retrieval

What it does: Automatically fetch relevant graph nodes and attached documents as context for each query.

User experience: On each query, the system retrieves related entities and documents from the graph and includes them in the model’s context. This improves factuality by anchoring the answer in graph-derived information.

Citation linking

What it does: Tie each claim back to a concrete source in the graph or document store.

User experience: Responses include inline citations that link to specific graph nodes or documents. Users can click a citation to open the source and verify what the model is referring to.

TRAINING DATA CREATION FEATURES
Conversation to dataset

What it does: Convert real interactions into structured training examples.

User experience: Users select conversations from the Predictions tab and convert them into training JSONL. The system preserves prompts, responses, and metadata in a consistent format suitable for SFT.

Preference pair generation

What it does: Turn model comparison results into preference data for methods like DPO.

User experience: When users compare responses and choose winners, the platform exports these as preference pairs. Each record has a prompt, a chosen response, and one or more rejected responses.

Synthetic data generation

What it does: Scale datasets by automatically generating new examples based on seeds.

User experience: Users provide seed examples and constraints. The system creates variations, paraphrases, and augmentations to expand the dataset while staying aligned with the original intent and style.

JUDGMENT PERSISTENCE FEATURES
Rating storage

What it does: Persist all evaluation signals in a structured database instead of scattered logs.

User experience: Every thumbs up/down, tag, detailed evaluation, and multi-axis rating is stored with the associated prediction, model version, and timestamp. This builds a long-term feedback corpus.

Historical judgment queries

What it does: Let users analyze how quality and failure modes evolve over time.

User experience: Users query judgments by model, time range, prompt type, or tag and see trends such as “quality improved after retraining” or “this category of prompts still fails frequently.”

Judgment export

What it does: Make feedback data available for external analysis and retraining.

User experience: Users export judgment data including prompt, response, rating, tags, timestamp, and model ID. This data can be fed into training pipelines or combined with other datasets for analysis.

TROUBLESHOOTING & DEBUGGING FEATURES
Error log aggregation

What it does: Centralize errors from multiple jobs and components into one place.

User experience: Under Monitoring → Error Logs, users see a combined view of errors from training, inference, and background jobs. Filters for severity, component, and time range help users focus on relevant incidents.

Stack trace viewer

What it does: Expose detailed error context without SSH access.

User experience: When a job fails, the UI shows the full stack trace with formatting and syntax highlighting. Developers can inspect error locations, messages, and call stacks directly in the browser.

Resource bottleneck detection

What it does: Identify which resources are limiting performance and suggest optimizations.

User experience: The system analyzes CPU, GPU, memory, disk I/O, and network usage alongside throughput. It flags bottlenecks and may provide recommendations such as adjusting batch size, increasing workers, or changing instance type.

Configuration validation

What it does: Catch configuration errors before jobs start and waste compute.

User experience: When users configure a training job, the system validates parameters against known constraints (e.g., GPU memory, allowed batch sizes, model compatibility). It surfaces warnings and errors so users can fix issues before launch.
