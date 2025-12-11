# The Dataset Quality Myth: What 77 Training Runs Taught Us

**Category:** Case Study
**Author:** FineTune Lab Team
**Published:** 2025-12-08
**Read Time:** 15 min
**Tags:** Dataset Curation, Lessons Learned, Quality vs Quantity, Real Talk

---

## The Uncomfortable Truth Nobody Wants to Hear

At FineTune Lab, we've experimented with several different ways of creating quality datasets. Most, if not all, have failed.

Creating quality data that your model can actually learn isn't about volume or the smartest reasoning model. It's about the nuances that only you—or the people within your company—are capable of understanding.

Nobody wants to hear this. They just don't. But the reality is that a dataset's quality is going to dictate the quality of the model you decide to fine-tune.

---

## The Pipeline Fantasy

We designed pipelines around reasoning models. The idea was simple: send in company data and Q&As, let the LLM organize everything, minimal human intervention required.

We started with DeepSeek. Relatively cheap, good reasoning skills. Should do the job, right?

It did a pretty good job. But it didn't work out the way we expected.

### What Reasoning Models Excel At:
- Creating verbose, well-structured responses
- Formatting data cleanly
- Following template instructions

### What They Can't Do:
- Understand the nuances your company data requires
- Maintain context across hundreds of Q&As
- Know what your platform actually looks like

---

## We Didn't Learn Our Lesson

Sad to say, we didn't learn right away. We kept testing.

- DeepSeek ❌
- GPT-5 Mini ❌
- GPT-5 ❌
- More expensive models ❌
- Less expensive models with better reasoning ❌

They all do a fantastic job of giving you incredibly structured, precise, accurate data based on what you provide. But the issue is **context**.

They can't keep it all together at the same time.

Every prompt you send requires the same structured template so the LLM formats your Q&As correctly, uses proper verbiage, follows your style. But you have to run that same prompt through each and every single time. And it doesn't mean they're going to get all the context necessary to provide proper answers.

---

## Our First Dataset Was Trash

And man, we didn't really know it.

We used it. The model learned a few things. But here's what it couldn't do:

**It couldn't say "no."**

The model wasn't able to tell users what we *don't* do as a company. It couldn't say "No, that's not something we offer" because we never taught it that.

Instead, it made up information. Close enough to be believable. Close enough to sound like something a platform like FineTune Lab would offer.

### The UI Navigation Nightmare

This got especially bad with UI components. Platforms like ours exist. Platforms in general have common names:

- Dashboards
- Panels
- Account Settings
- Settings pages

The model confused these constantly. It would reference a "dashboard" we don't have. It would tell users to click buttons that don't exist. It would navigate them to pages with wrong names.

And here's the thing: **You can't ask DeepSeek or GPT-5 Pro to understand how to navigate your specific website.**

Even if you send massive amounts of data to these models—and maybe you can afford to do that—you're still not going to get the quality data you'd get if you do this properly.

---

## What "Properly" Actually Means

Properly means sitting down in front of each and every one of those Q&As, going over them, and making sure they say exactly what you want them to say.

That's it. That's the secret.

There's no shortcut. There's no magic prompt. There's no reasoning model smart enough to replace you actually knowing your product.

---

## Perfect Training ≠ Working Model

We've had training runs that look perfect on paper.

Loss curves trending down beautifully. Eval metrics looking great. Everything checking out.

Then we test in the actual web portal where users interact with it.

**Garbage.**

Testing is the only real way to say "hey, this works." You may have a flawless training session, but if the model didn't actually learn the data because:

- It was scrambled or incorrect
- You had contradictory information
- Not enough ambiguous examples
- No negatives telling the model what NOT to say
- No adversarials testing edge cases

...then it doesn't matter how pretty your loss curve looked.

---

## Hundreds of Training Runs. 90% Failed.

Let's be real. Not every run teaches you something. Most of them—probably 90%—fail miserably.

Setting up training isn't difficult—especially on our platform.

What's difficult is:

- Waiting for models to download
- Waiting for datasets to upload and tokenize
- Running the same experiment hundreds of times trying to find:
  - The perfect conditions
  - The right parameters
  - The right GPU
  - The right model for the task

You don't want a thinking model if you need a model you can instruct. You don't want it reasoning through everything if you're telling it exactly what to do.

And vice versa—you don't want a model that just follows orders if you need reasoning behind decisions.

### The One Signal That Actually Matters

**The better the data, the better the training curves.**

When your data is good:
- Loss curves are smooth, not erratic
- The gap between train loss and eval loss stays tight
- Curves trend down together, consistently

When your data is garbage:
- Curves are all over the place
- Train loss drops but eval loss stays high (overfitting on noise)
- Or both just plateau and go nowhere

That gap between train loss and eval loss? That's your data quality indicator.

- **Tight gap** = model is learning generalizable patterns
- **Wide gap** = model is memorizing garbage

We didn't learn this from a paper. We learned it from staring at hundreds of failed training runs in the analytics page, trying to figure out what the hell went wrong.

---

## What We Actually Learned

After all the iteration, the money spent, the time and research trying to figure out what quality actually looks like:

We went from **shit quality** → **relatively good quality** → **final iteration where the model learns 99% of what we're teaching it.**

### The GraphRAG Realization

We don't need GraphRAG for knowledge that doesn't change.

GraphRAG should be used for its strengths:
- Data that changes periodically
- Information that updates frequently enough that retraining doesn't make sense
- Dynamic content that would be impractical to bake into the model

But for stable knowledge? For how your platform works, where buttons are, what features you offer? That belongs in the model itself.

If you've got something that works really, really well—don't risk screwing it up with constant retraining. Use RAG for what changes, fine-tune for what doesn't.

---

## Who We Are

At FineTune Lab, we're not engineers. We're not data scientists or data miners. We're not the most knowledgeable about how AI works and what it takes to build the perfect AI.

But we're passionate.

- Passionate about the future
- Passionate about technology
- Passionate about making changes
- Passionate about helping people
- Passionate about offering tools that major corporations either can't offer because it's not profitable, or refuse to offer because they're too good

We don't want to come across as know-it-alls who understand everything about MLOps and AI development. But we absolutely want to help push this further.

We want to get AI fine-tuning in the hands of:

- The 16-year-old kid in the basement studying quantum mechanics
- The Tony Starks of the world who don't have money but have know-how
- People who want to push the envelope
- People with ideas who want to see humanity grow

**We started this company for people like you.**

---

## The Iteration Loop

We continue to iterate not because we enjoy it, but because it's necessary.

Here's the actual process:

```
1. Curate dataset
2. Train model
3. Assess training metrics
4. TEST IN PRODUCTION (this is the real test)
5. Identify failures
6. Fix the data
7. Repeat until the model does exactly what you want
```

Quality and balance over quantity. Always.

---

## The Bottom Line

A quality dataset has nothing to do with the largest, most powerful reasoning model.

It has everything to do with the nuances that only you—or the people within your company—are capable of answering.

Most of this information is available online. You can find it anywhere. But it hits different when you're discovering it yourself:

- Iteration after iteration
- Experiment after experiment
- Model download after model download
- Waiting for everything to set up properly
- 77 times a day
- Just trying to find what works

That's the job. That's what quality actually costs.

---

*This is a living document. We'll update it as we continue learning.*
