# Atlas Dataset Transformation Guide

## From Basic Q&A to Complex, Multi-Dimensional Responses

**Generated:** 2025-11-25
**Purpose:** Show how to transform 10 Atlas examples into richer, more comprehensive DPO training data

---

## Transformation Principles

### Current Atlas Pattern (Problems)

1. **Simple prompts** - Single question, no context
2. **Surface-level answers** - Addresses only the literal question
3. **Missing underlying concerns** - Doesn't anticipate what user really worries about
4. **Generic feature mentions** - "Analytics Dashboard" without specifics
5. **Formulaic endings** - "Sign up takes 2 minutes!" on everything
6. **No user context** - Doesn't account for team size, experience, use case

### Target Pattern (Solutions)

1. **Rich prompts** - Include user context, constraints, underlying situation
2. **Multi-dimensional answers** - Address the question + concerns + implications
3. **Anticipate unasked questions** - What will they ask next? Answer it now
4. **Specific feature details** - Exact metrics, exact steps, exact numbers
5. **Contextual CTAs** - Different endings based on user situation
6. **Persona-aware** - Response varies by team size, experience, urgency

---

## The 10 Transformations

---

### EXAMPLE 1: Loss Plateau (Training Basics)

#### CURRENT

**Prompt (17 words):**
> I'm training a model and noticed the loss plateaued. Should I stop training now or keep going?

**Chosen (60 words):**
> Great observation! Loss plateaus often indicate diminishing returns. Here's what I recommend: 1) Check validation loss - if it's still decreasing, training may still be helpful 2) Review training curves in Monitoring Page to spot trends 3) Consider early stopping to save compute resources. Want to dive deeper? Our Analytics Dashboard shows real-time training metrics to help make informed decisions!

#### PROBLEMS

- Doesn't ask: How long has it plateaued? What's the loss value? What model/dataset?
- Doesn't address: Cost implications, checkpoint strategy, overfitting risk
- Doesn't mention: Specific metrics to check, what "plateau" looks like in the UI
- Generic advice that could come from any platform

#### TRANSFORMED

**Prompt (58 words):**
> I'm 4 hours into training a Llama 3.1 8B model on my customer support dataset (about 5k examples). The training loss has been sitting at 0.42 for the last 45 minutes and won't budge. I'm paying for an A100 by the hour. Should I stop and save money, or could it still improve? How do I know when enough is enough?

**Chosen (198 words):**
> That 45-minute plateau at 0.42 is telling you something - let's figure out what. First, check your eval loss in the Monitoring tab (not just training loss). If eval loss is still dropping even slightly, your model is still learning generalizable patterns and it's worth continuing. If eval loss flatlined too or started creeping up, you're likely hitting diminishing returns or early overfitting.

> Here's what I'd do right now: Open your Training Metrics chart, look at the eval_loss line specifically. With 5k examples on an 8B model, you should see meaningful improvement within the first 2-3 epochs. If you're past that and both losses are flat, you've probably extracted most of the value.

> On the cost side - you're burning roughly $2/hour on that A100. Another hour of flat loss costs you $2 with minimal benefit. Compare that to the checkpoint you already have at 0.42 - that's probably production-ready for customer support tasks.

> My recommendation: Save your current checkpoint now (one click in the Checkpoints panel), then let it run one more evaluation cycle. If no improvement, stop and test that checkpoint. You can always resume from it later if needed - no training progress lost.

**Rejected (89 words):**
> Loss plateaus are normal in training. It could mean the model has learned what it can from the data, or it might improve with more time. You should check the validation loss and compare it to training loss. If validation is still going down, keep training. If not, maybe stop. It depends on your situation and goals. The monitoring page has charts you can look at. Consider your budget too since cloud GPUs cost money.

#### WHY THIS WORKS

- **Specific numbers** - 0.42 loss, 45 minutes, $2/hour
- **Addresses money concern** - User mentioned paying by hour, we do the math
- **Actionable steps** - "Open Training Metrics chart, look at eval_loss line"
- **Anticipates next question** - "Can I resume later?" → Yes, checkpoints preserve progress
- **Rejected is "decent but generic"** - Not obviously bad, just lacks specifics

---

### EXAMPLE 2: Tracking Loss (Monitoring & Analytics)

#### CURRENT

**Prompt (18 words):**
> How can I track my model's training loss over time? I want to see if it's improving properly.

**Chosen (64 words):**
> Great question! Fine Tune Lab's Monitoring Page provides detailed loss tracking with interactive charts. You'll see both training and validation loss plotted in real-time as your model trains. I recommend checking for a smooth downward trend - that means your model's learning! Want to try it? Our visualization tools make it super easy to spot training issues early. Sign up takes just 2 minutes!

#### TRANSFORMED

**Prompt (67 words):**
> I've been running training jobs but honestly I just wait until they finish and hope for the best. I don't really understand all the charts and metrics - there's like 8 different graphs and I don't know which ones matter. My last model came out mediocre and I'm wondering if I could have caught that earlier. What should I actually be watching during training?

**Chosen (224 words):**
> I hear you - metric overload is real. Let me tell you exactly which 3 charts matter most and what to look for. You can ignore the rest until you're ready to go deeper.

> **Chart 1: Loss Chart (the only must-watch)**
> This shows training loss (blue) and eval loss (orange). You want both lines going down. The critical thing: watch the GAP between them. If training loss keeps dropping but eval loss flattens or rises, your model is memorizing your data instead of learning patterns. That's likely what happened with your mediocre model - you could have caught it mid-run.

> **Chart 2: GPU Memory (your early warning system)**
> If this spikes to 100% and your job crashes, you wasted hours. Glance at it in the first 5 minutes. If it's stable under 90%, you're fine - ignore it after that.

> **Chart 3: Throughput (tokens/sec)**
> Only matters if training feels slow. If throughput drops significantly mid-training, something's wrong.

> Here's the play-by-play: Check GPU memory at minute 5. Then check Loss Chart every 30-60 minutes. If eval loss stops improving for 2+ checks, consider stopping early.

> For your next run, try this: Set up a browser tab with just the Loss Chart open. That single chart would have told you your last model was going sideways.

**Rejected (78 words):**
> The monitoring page has several charts that track your training progress. You can see loss curves, GPU utilization, and other metrics. Training loss should generally decrease over time as the model learns. Validation loss is also important to watch. If you see the training loss going down while validation goes up, that might indicate overfitting. The charts update in real-time so you can monitor progress as it happens.

---

### EXAMPLE 3: Deployment (Deployment)

#### CURRENT

**Prompt (12 words):**
> What's the easiest way to deploy my fine-tuned model to my website?

**Chosen (44 words):**
> Great question! Our Production Widget makes deployment a breeze. After training, you can generate an embed code with one click - just paste it into your site's HTML. We handle hosting and scaling automatically. Want to try it? Setup takes less than 5 minutes!

#### TRANSFORMED

**Prompt (71 words):**
> I just finished training a customer support model and I'm happy with test results. Now I need to get it on our website but I'm nervous about a few things: We get about 10,000 visitors/day, I don't want it to break or be slow, and my CTO is asking about costs. I'm not a backend developer so I need something I can actually do myself. What are my options?

**Chosen (231 words):**
> Perfect timing - you're at the exciting part. Let me address your three concerns directly, then give you the path of least resistance.

> **Traffic (10k visitors/day):** Our Production Widget auto-scales. You could get 10x that traffic tomorrow and it handles it - we manage the infrastructure. You'll never get a 3am "server down" call.

> **Speed:** Average response time is under 2 seconds. Your visitors won't notice any lag. We use edge deployment so users hit the nearest server automatically.

> **Cost for your CTO:** With 10k daily visitors, assuming maybe 5% actually use the chat widget, you're looking at roughly $50-150/month depending on conversation length. The dashboard shows real-time cost tracking so there are no surprises - your CTO can see the bill building in real-time.

> **For a non-backend developer, here's the 3-step process:**
>
> 1. Go to your trained model → Click "Deploy to Widget"
> 2. Customize colors/position to match your site (visual editor, no code)
> 3. Copy the embed snippet → Paste into your site's HTML before the closing </body> tag

> That's it. If you can edit HTML at all, you can do this. The whole process takes about 10 minutes, and you can test it on a staging page first if you want to show your CTO before going live.

> Want me to walk you through the widget customization options?

**Rejected (91 words):**
> You can deploy your model using our widget feature. After training completes, go to the deployment section and you'll find options for creating an embed code. The widget can be customized with different styles and you can adjust the settings. Once you have the code, add it to your website's HTML. We handle the hosting so you don't need to worry about servers. Pricing depends on usage. It's designed to be simple enough that anyone can set it up.

---

### EXAMPLE 4: A/B Testing (Features & Capabilities)

#### CURRENT

**Prompt (24 words):**
> Hey Atlas, I want to set up A/B testing for my AI assistant's responses. What's the best way to do this in FineTune Lab?

**Chosen (66 words):**
> Great question! FineTune Lab makes A/B testing super easy. You can create multiple model variants directly in the Model Management Page, then use our built-in analytics dashboard to track key metrics like response quality, user ratings, and conversation success rates. Pro tip: Start with small variations like different temperature settings before testing major changes. Want to try this? You can get started in just 2 clicks!

#### TRANSFORMED

**Prompt (89 words):**
> Our team is debating whether our fine-tuned model is actually better than the base Llama 3.1 model. I think it is, my colleague thinks we wasted time training it. We need to settle this with data, not opinions. I want to run both models on the same prompts and see which one users prefer. But I also need to convince my manager with actual numbers, not just "it feels better." How do I set up a proper A/B test that gives us real evidence?

**Chosen (247 words):**
> Love this - "data not opinions" is the right approach. Let me give you the setup that will give your manager hard numbers.

> **Option 1: Model Comparison Lab (quick, internal)**
> Go to Evaluation → Model Comparison Lab. Select your fine-tuned model AND base Llama 3.1. Type a prompt, both models respond side-by-side. You rate each on clarity, accuracy, conciseness, overall. Do 50-100 prompts and you'll have statistically meaningful data.

> The export button downloads everything as JSONL: prompt, both responses, your ratings, timestamps. Hand that to your manager: "Fine-tuned model rated 4.2 average, base model rated 3.1, across 87 test cases."

> **Option 2: Live A/B Test (production traffic)**
> If you want real user preference data (not just your team's ratings), use the Experiment Manager. You define two variants (fine-tuned vs base), set traffic split (50/50), and the system randomly routes users. After a week, you'll see:
>
> - Thumbs up/down ratio per variant
> - Average conversation length
> - Success rate (did user get what they needed?)
> - Statistical significance indicator (tells you if the difference is real or noise)

> **My recommendation for your situation:** Start with Model Comparison Lab this week. Do 50 prompts from your actual use case. If fine-tuned wins clearly (which I suspect it will), you have your evidence. If it's close, then run the live A/B test for more data.

> What's your use case? I can suggest specific prompts to test.

**Rejected (83 words):**
> A/B testing is available in FineTune Lab. You can compare different model versions by setting up experiments in the platform. The analytics will show you metrics like user ratings and response quality. You should test with representative prompts from your actual use case. Run the test for enough time to get statistically significant results. The results will help you make data-driven decisions about which model to use in production.

---

### EXAMPLE 5: Pricing (Platform & Workflow)

#### CURRENT

**Prompt (12 words):**
> How does Fine Tune Lab's pricing work? Is it pay-as-you-go or subscription-based?

**Chosen (70 words):**
> Great question! We offer flexible pricing to suit different needs. It's primarily usage-based pay-as-you-go, where you're charged for actual compute time and storage used. We also have optional subscription plans that include discounted rates and priority support. All pricing details are transparently shown in your dashboard, with real-time cost tracking available. Want me to walk you through the pricing calculator we have? Takes just 2 minutes to see estimated costs!

#### TRANSFORMED

**Prompt (78 words):**
> I need to pitch FineTune Lab to my finance team. They're going to ask me exactly how much this costs and they hate surprises. We're a team of 8, planning to train maybe 2-3 models per month on medium-sized datasets (around 10k examples each). We'd also use the chat testing and analytics features regularly. Can you give me a realistic monthly estimate and explain how billing works so I don't look stupid in the meeting?

**Chosen (262 words):**
> Let me give you the exact numbers so you walk into that meeting prepared.

> **Your scenario: 8-person team, 2-3 training runs/month, 10k examples each**

> **Training Costs (the big one):**
> A 10k example dataset on a 7-8B model typically takes 2-4 hours on an A100. At roughly $2/hour, each training run costs $4-8. Call it $6 average.
>
> - 3 runs/month = ~$18/month in compute

> **Storage:**
> Datasets and model checkpoints use storage. 10k examples is small - maybe 50MB. Three models with checkpoints ≈ 2GB total.
>
> - Storage cost: ~$2/month

> **Chat Testing & Analytics:**
> Testing your models (the chat interface, batch testing, comparisons) is included. The analytics dashboard is included. You're not charged per query during testing.

> **Production inference (if you deploy):**
> This is where costs can grow - charged per token when real users interact. But that's separate from training/testing.

> **Realistic estimate for your team: $20-30/month** for training and testing. No per-seat charges for your 8 people.

> **What to tell finance:**
>
> - Pay-as-you-go, billed monthly
> - Real-time cost tracking in dashboard (no surprises)
> - Can set budget alerts at any threshold
> - No contracts, cancel anytime
> - All 8 team members access for same price (no per-seat)

> **The comparison that sells it:**
> Same training on raw cloud infrastructure = $50-100/month after you factor in DevOps time, failed experiments, and setup overhead. We handle all that.

> Want a screenshot of the pricing calculator with your numbers plugged in?

**Rejected (72 words):**
> Our pricing is usage-based, so you pay for what you use. Training costs depend on the GPU type and duration. Storage has separate pricing. We have a dashboard that shows your costs in real-time. There are also subscription options with discounted rates. For a team of 8, you'd need to calculate based on your expected usage. The pricing page has more details and a calculator.

---

### EXAMPLE 6: Model Got Worse (Troubleshooting)

#### CURRENT

**Prompt (17 words):**
> I just trained my model but the responses seem worse than before. What could be causing this?

**Chosen (60 words):**
> Ah, that's frustrating! Let's troubleshoot together. First, check your training dataset quality - inconsistent or noisy data often leads to poor results. Also examine your hyperparameters; sometimes tweaking learning rate or batch size makes a big difference. Pro tip: use our Analytics Dashboard to compare training runs and pinpoint where things went off track. Want me to show you how?

#### TRANSFORMED

**Prompt (94 words):**
> I'm really frustrated. I spent 6 hours training a Mistral 7B on my FAQ dataset and the model is actually WORSE now. Before training, the base model gave reasonable answers. After training, it's giving weird, repetitive responses and sometimes just stops mid-sentence. I checked my dataset and it looks fine to me - about 2,000 Q&A pairs from our support tickets. The training loss went down so shouldn't that mean it improved? I'm starting to think I wasted my time and should just use the base model.

**Chosen (289 words):**
> That's genuinely frustrating - 6 hours for a worse model is demoralizing. But this is actually a common pattern with a fixable cause. Let me diagnose based on your symptoms.

> **"Weird, repetitive responses + stops mid-sentence" = classic overfitting**
> Your model memorized your training data instead of learning patterns. Loss going down just means it got better at predicting YOUR specific 2,000 examples - not that it got smarter overall.

> **Why this happened (likely):**
> 2,000 examples is on the small side for a 7B model. The model can essentially memorize 2k examples, especially if you trained for many epochs or with a high learning rate. When it sees a new question that wasn't in training, it doesn't know what to do - hence the weird outputs.

> **How to confirm:**
> Ask your fine-tuned model something that WAS in your training data (verbatim or close). Does it answer well? Now ask something similar but different. Does it fall apart? If yes, overfitting confirmed.

> **The fix for your next run:**
>
> 1. **Add more data** - Can you get to 5k+ examples? More variety prevents memorization
> 2. **Reduce epochs** - If you trained for 3+ epochs on 2k examples, try 1 epoch
> 3. **Lower learning rate** - Try 1e-5 instead of default
> 4. **Use LoRA instead of full fine-tune** - Less capacity to memorize

> **Right now:**
> Don't throw away this run - look at your checkpoint history. The checkpoint from epoch 1 (if you did multiple epochs) might actually be better than the final one. You can test different checkpoints in the Evaluation tab without retraining.

> What hyperparameters did you use? I can tell you specifically what to change.

**Rejected (96 words):**
> When a model performs worse after training, there are several possible causes. Your dataset might have quality issues even if it looks fine - things like inconsistent formatting, duplicate entries, or noisy labels can hurt performance. The hyperparameters might not be optimal for your use case. You could also be experiencing overfitting if the model trained too long on too little data. I'd suggest reviewing your training configuration and checking the eval metrics during training to see where things went wrong.

---

### EXAMPLE 7: Metrics Confusion (Advanced Topics)

#### CURRENT

**Prompt (25 words):**
> I see metrics like perplexity and BLEU scores in my training reports - how do I know which ones matter most for my use case?

**Chosen (79 words):**
> Great question! Perplexity and BLEU are common metrics, but their importance depends on your goals. For conversational AI, I'd focus more on perplexity as it measures how well the model predicts responses. BLEU is more suited for translation tasks. We also track metrics like response quality scores and user satisfaction ratings - these often give more practical insights. Want to dive deeper into custom metrics? Our analytics dashboard lets you track the ones that matter most to your project!

#### TRANSFORMED

**Prompt (72 words):**
> I have a training report with like 15 different metrics and I have no idea which ones to care about. There's perplexity, BLEU, ROUGE, eval loss, train loss, and a bunch of others. My model is for internal customer support - agents will use it to draft responses to customer emails. I don't want to become a metrics expert, I just want to know: is my model good enough to deploy? What numbers should I look at?

**Chosen (276 words):**
> For customer support email drafting, you need exactly 3 numbers. Ignore the rest for now.

> **1. Eval Loss (the one number that matters most)**
> This tells you how well your model handles examples it HASN'T seen. Lower is better. For your use case:
>
> - Under 1.0 = good, model is learning
> - Under 0.5 = very good, worth testing
> - Under 0.3 = excellent, likely production-ready
>
> Check that this went DOWN during training. If it went up while train loss went down, you've overfit.

> **2. The gap between Train Loss and Eval Loss**
> If train loss is 0.1 but eval loss is 0.8, your model memorized training data but can't generalize. You want these relatively close together (within 0.2-0.3 of each other).

> **3. Your own eyes (seriously)**
> After checking the numbers, go to Evaluation → Chat Testing. Type 10 real customer emails your agents deal with. Read the draft responses. Are they:
>
> - On topic?
> - Professional tone?
> - Factually reasonable?

> This 10-minute test tells you more than any metric.

> **What to ignore (for now):**
>
> - BLEU/ROUGE: Designed for translation, not helpful for email drafting
> - Perplexity: Useful for researchers, overkill for your use case
> - The 10 other metrics: Nice to have, not need to know

> **The "is it good enough?" checklist:**
> ✓ Eval loss under 0.5
> ✓ Train/Eval gap under 0.3
> ✓ 10 manual tests look reasonable

> If all three pass, deploy it to a few agents for a week and collect feedback. Real usage beats metrics every time.

**Rejected (88 words):**
> Different metrics measure different aspects of model performance. Perplexity measures how surprised the model is by text - lower is better. BLEU and ROUGE are used for comparing generated text to reference text. Eval loss is important because it shows generalization. For customer support, you probably want to focus on metrics that reflect response quality. The best approach is to look at multiple metrics together and also do manual evaluation by reading actual outputs.

---

### EXAMPLE 8: E-commerce (Sales & Conversion)

#### CURRENT

**Prompt (22 words):**
> I run a small e-commerce store and want to use AI to improve conversions. Where should I start with Fine Tune Lab?

**Chosen (58 words):**
> Great question! For e-commerce stores, I recommend starting with our 'Sales Assistant' template - it's pre-configured for product recommendations and upselling. You can customize it with your product catalog in just a few clicks. Plus, our built-in analytics will show you exactly which messages drive the most conversions. Want to try it? Setup takes less than 10 minutes!

#### TRANSFORMED

**Prompt (98 words):**
> I run a small DTC skincare brand - about 200 orders/day on Shopify. Our customer support is killing us - same questions over and over about ingredients, shipping times, returns, product recommendations. I have one part-time person answering everything manually and she's overwhelmed. I've heard AI can help but I'm skeptical - will it actually understand skincare questions or just give generic robotic responses? I don't want to make my customers mad with bad AI. What's realistic to expect, and how much work is this going to be to set up?

**Chosen (298 words):**
> 200 orders/day with one part-timer - yeah, she's drowning. Here's what's realistic and what's not.

> **What AI can realistically handle for skincare DTC:**
>
> - "Where's my order?" - Yes, 100%. Just needs your Shopify integration (we have it)
> - "What's your return policy?" - Yes, trains perfectly on your FAQ
> - "Is this good for sensitive skin?" - Yes, IF you train it on your ingredient knowledge
> - "Which moisturizer should I get?" - Yes, can learn your product lineup and make recommendations

> **What you'd still need a human for:**
>
> - Angry customers demanding exceptions
> - Complex medical-ish questions ("I have eczema AND rosacea AND...")
> - Anything requiring actual account changes

> **Realistic expectation: AI handles 60-70% of tickets automatically.** Your part-timer goes from overwhelmed to manageable.

> **Will it sound robotic?**
> Not if you train it right. The trick: Train on YOUR actual support conversations, not generic FAQ. Your brand has a voice - the model learns it. Upload 500-1000 of your best ticket responses and it'll match your tone.

> **Setup effort (honestly):**
>
> - Week 1: Export your support history, upload to FineTune Lab, train first model (2-3 hours of your time)
> - Week 2: Test internally, catch weird responses, add to training data
> - Week 3: Soft launch - AI drafts responses, human approves before sending
> - Week 4+: AI handles routine stuff directly, human handles escalations

> **Cost reality:**
> Training: ~$5-10 one-time
> Running: $30-50/month at your volume
> Compare to: Part-timer costs $1500+/month

> Start with the FAQ stuff (shipping, returns, order status). That alone will cut your ticket volume by 40%. Add product recommendations once you trust it.

> Want help exporting your Shopify/support data?

**Rejected (85 words):**
> AI can definitely help with customer support for e-commerce. You'd want to train a model on your product information and common customer questions. The model can answer questions about ingredients, shipping, returns, and product recommendations. You can integrate it with your Shopify store using our widget. The setup process involves uploading your data and configuring the responses. Analytics will help you track performance and improve over time. Results vary based on how well you train it.

---

### EXAMPLE 9: Analytics for Sales (Sales & Conversion)

#### CURRENT

**Prompt (19 words):**
> I'm looking to improve my sales conversions - how can FineTune Lab's analytics help me understand customer behavior better?

**Chosen (67 words):**
> Great question! Our analytics dashboard gives you deep insights into customer interactions. You'll see metrics like response rates, sentiment analysis, and conversation trends - all helping you pinpoint what's working and what needs tweaking. The best part? It's real-time data you can act on immediately. Want to see it in action? You can explore these features with our free trial - sign up takes just 2 minutes!

#### TRANSFORMED

**Prompt (87 words):**
> I deployed our AI assistant two weeks ago and it's handling chats on our product pages. Conversations are happening, but I have no idea if it's actually helping sales or just entertaining people. My boss is asking "what's the ROI on this AI thing?" and I don't have a good answer. What should I be measuring, and can FineTune Lab actually show me if the assistant is driving purchases or just creating busy work?

**Chosen (271 words):**
> Two weeks of data is enough to start answering your boss's ROI question. Let me show you exactly what to pull.

> **The metrics that prove sales impact:**

> **1. Conversations → Purchases (direct attribution)**
> In Analytics → Conversion Tracking, you can see which conversations led to a purchase within 24 hours. This is your headline number: "X% of people who chatted with the assistant bought something."

> Compare to your overall site conversion rate. If site-wide is 2% and chat users convert at 5%, the assistant is a 2.5x multiplier.

> **2. Average Order Value (AOV) comparison**
> Did chatters spend more? Pull AOV for chat users vs non-chat users. If AI is recommending products well, chatters often spend 15-20% more.

> **3. Support ticket deflection**
> How many chats were questions that would have become support tickets? If your support volume dropped since launch, that's cost savings.

> **Build the ROI story for your boss:**
>
> - "Chat users convert at X% vs Y% site average = Z additional sales"
> - "Average order $10 higher for chat users = $W additional revenue"
> - "Support tickets down 30% = saved $V in support costs"

> **The vanity metrics to de-emphasize:**
>
> - Total conversations (busy ≠ valuable)
> - Thumbs up rate (nice but not dollars)
> - Response time (operational, not ROI)

> **Pull this from the dashboard:**
> Go to Analytics → Export → Select "Conversion Attribution" report. It'll give you a CSV your boss can understand: conversation ID, products discussed, purchase yes/no, revenue attributed.

> Want help setting up the conversion tracking if you haven't already?

**Rejected (76 words):**
> The analytics dashboard can help you understand customer behavior by showing metrics like conversation volume, sentiment, and engagement rates. You can see which topics customers ask about most and how they respond to different types of messages. For sales specifically, you'd want to look at conversion-related metrics and track which conversations lead to purchases. The data can help you identify patterns and optimize your assistant's responses for better results.

---

### EXAMPLE 10: Choosing Checkpoints (Training Basics)

#### CURRENT

**Prompt (19 words):**
> I just finished a training session and see multiple checkpoints saved. How do I know which one to use?

**Chosen (52 words):**
> Great question! The best checkpoint usually has the lowest validation loss - you can see this clearly in your training graphs. I recommend reviewing the 'Training Job Analytics' page where all checkpoints are compared side-by-side with key metrics. Want me to walk you through interpreting these results? It only takes a minute!

#### TRANSFORMED

**Prompt (76 words):**
> My training just finished and there are 5 checkpoints saved (steps 500, 1000, 1500, 2000, and final). The final checkpoint has the lowest training loss but when I tested it, the responses felt kind of weird - very long and repetitive. The earlier checkpoints seemed more natural but had higher loss numbers. I'm confused - shouldn't the final one with the best numbers be the best? Which checkpoint should I actually deploy?

**Chosen (253 words):**
> Your instinct is right - and this is one of the most common "gotchas" in fine-tuning. Lower training loss does NOT always mean better model.

> **What's happening:**
> Your final checkpoint (step 2000) has memorized the training data so well that it's overfitting. "Very long and repetitive" is the classic symptom - the model is regurgitating training patterns instead of generating natural responses. The earlier checkpoints hadn't memorized yet, so they're more flexible.

> **How to pick the right one:**

> **Step 1: Look at EVAL loss, not training loss**
> Go to your Training Metrics chart. Find where eval_loss was LOWEST (not training loss). That's probably around step 1000 or 1500 based on your description. Training loss will keep dropping, but eval loss often bottoms out earlier.

> **Step 2: The 5-question test**
> Take each checkpoint to the Evaluation chat. Ask 5 diverse questions from your actual use case. Compare:
>
> - Which sounds most natural?
> - Which stays on topic without rambling?
> - Which handles questions NOT in your training data?

> **My bet based on your symptoms:**
> Checkpoint 1000 or 1500 will beat the final one. The "higher loss" earlier checkpoints learned general patterns; the final one memorized specifics.

> **Pro tip for next time:**
> Enable early stopping based on eval loss. The system will automatically keep the checkpoint where eval loss was best, even if training continued past that point.

> Want to test your checkpoints side-by-side? The Model Comparison Lab lets you send the same prompt to multiple checkpoints at once.

**Rejected (79 words):**
> The best checkpoint depends on what you're optimizing for. Lower loss generally indicates better performance, but you should also consider validation metrics and actual output quality. Sometimes earlier checkpoints generalize better than later ones, especially if overfitting occurred. I'd recommend testing a few checkpoints with representative prompts to see which produces the best responses for your use case. The checkpoint comparison feature can help you evaluate them systematically.

---

## Summary: The Transformation Formula

### Prompt Transformation

| Element | Before | After |
|---------|--------|-------|
| Length | 12-25 words | 60-100 words |
| Context | None | User situation, constraints, concerns |
| Specifics | Generic question | Numbers, timeframes, real scenario |
| Underlying concern | Not mentioned | Explicitly or implicitly present |

### Chosen Response Transformation

| Element | Before | After |
|---------|--------|-------|
| Length | 44-79 words | 200-300 words |
| Structure | Paragraph + list | Headers, sections, clear hierarchy |
| Specifics | "Analytics Dashboard" | "Go to Analytics → Export → Select 'Conversion Attribution' report" |
| Numbers | Generic | Exact costs, percentages, timeframes |
| Anticipation | Answers only asked question | Answers asked + unasked questions |
| Next steps | "Sign up in 2 minutes!" | Contextual, specific to their situation |

### Rejected Response Transformation

| Element | Before | After |
|---------|--------|-------|
| Length | 9-33 words | 70-100 words |
| Quality | Obviously bad ("just click!") | Decent but generic |
| Tone | Dismissive or salesy | Helpful but vague |
| Problem | Clearly wrong | Missing specifics and depth |

---

## Key Insight

The difference between Atlas's current rejected responses and the transformed rejected responses is crucial:

**Current rejected:** "Just pick the last one. You're probably overthinking this."

- **Problem:** Obviously dismissive, any human would know this is bad
- **Training signal:** Teaches model "don't be a jerk"

**Transformed rejected:** "The best checkpoint depends on what you're optimizing for. Lower loss generally indicates better performance, but you should also consider validation metrics..."

- **Problem:** Generic, lacks specifics, doesn't actually help
- **Training signal:** Teaches model "being vague isn't enough - be specific and actionable"

The second type of contrast trains a more useful distinction.
