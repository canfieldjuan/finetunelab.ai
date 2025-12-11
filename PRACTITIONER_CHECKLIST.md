**Practitioner's Checklist**

- **Goal & Baseline:** Define the task, baseline metrics, and a held-out test set before fine-tuning.
- **Method Choice:** On‑prem: use LoRA/QLoRA/PEFT for limited GPU budgets. Cloud: consider full fine-tune if budget and scale allow.
- **Compute & Checkpoints:** Save frequent checkpoints; keep smaller batch sizes on limited GPUs; verify checkpoint restore locally before long runs.
- **Reproducibility:** Pin `transformers`/`accelerate` versions, use `safetensors` where possible, log hyperparams and random seeds, and store training config next to checkpoints.
- **Data Preparation:** Deduplicate, normalize text, tokenize with the chosen model tokenizer, and split into train/validation/test sets. Remove navigation boilerplate from web-scrapes.
- **Chunking & Tokenization:** For LLMs chunk documents into 512–1024 token segments (or as required by base model). Validate the tokenizer output on sample inputs.
- **Instruction Format:** For instruction tuning use a consistent prompt/response format (Alpaca/ShareGPT style) and keep training and deployment prompts aligned.
- **Validation & Monitoring:** Track validation metrics (not just loss), run realistic prompts each epoch, and test for regression on held-out scenarios.
- **Security & Secrets:** For background persistence ensure service-role keys and job env vars (e.g., `SUPABASE_SERVICE_ROLE_KEY`, `JOB_ID`) are set and rotated securely.
- **Small-data Strategies:** If data <5k examples, prefer LoRA / synthetic augmentation and heavy validation; do not blindly full fine-tune with <1k examples.
- **Speech & Audio:** For Whisper/TTS fine-tuning pay attention to sample rate, chunk length, and alignment of audio↔text pairs.
- **Operational Checklist:** Add diagnostic logging for runtime flags (e.g., `IS_CLOUD`, `USER_ID`) and include a lightweight `PredictionsDiagnostic` check in monitoring UIs.

---

If you'd like, I can:

- add this as `PRACTITIONER_CHECKLIST.md` to the repo (done),
- expand any item into runnable commands (tokenizer checks, `datasets` examples), or
- generate a minimal dataset-prep script for your chosen model.
