# Quick Setup: OpenAI Integration

## ⚡ Quick Start (2 minutes)

### 1. Install Dependencies
Already done! ✅ `openai` package is installed.

### 2. Set Your OpenAI API Key

Create a file called `.env.local` in the `web-ui` folder:

```bash
# Copy the example file
cp .env.local.example .env.local
```

Then edit `.env.local` and add your keys:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
OPENAI_API_KEY=sk-proj-...your-key-here...
```

**Get your OpenAI key:** https://platform.openai.com/api-keys

### 3. Restart the Dev Server

```bash
npm run dev
```

### 4. Test It!

1. Go to http://localhost:3000
2. Login/signup
3. Click "New Chat"
4. Send a message
5. Watch the AI response stream in real-time! ✨

---

## 🎛️ Configuration

Edit `.env` to change models and settings:

```bash
# LLM Provider (openai, anthropic, ollama)
LLM_PROVIDER=openai

# OpenAI Settings
OPENAI_MODEL=gpt-4o-mini      # Change to gpt-4o for better responses
OPENAI_TEMPERATURE=0.7         # 0-2, higher = more creative
OPENAI_MAX_TOKENS=2000         # Max response length
OPENAI_STREAM=true             # Enable streaming responses
```

**Note:** Configuration migrated from YAML to environment variables.
See `docs/LLM_CONFIG_UNIFICATION_COMPLETE.md` for details.

---

## ✅ What's Implemented

- ✅ Real-time streaming responses
- ✅ Full conversation history context
- ✅ Database persistence
- ✅ Error handling
- ✅ Professional UI with streaming indicators

---

## 📝 Key Files

```
web-ui/
├── .env                            # LLM configuration (env vars)
├── lib/
│   └── config/
│       └── llmConfig.ts            # Configuration loader
├── lib/
│   └── llm/
│       └── openai.ts               # OpenAI integration
├── app/
│   └── api/
│       └── chat/
│           └── route.ts            # Streaming API endpoint
└── docs/
    └── LLM_INTEGRATION.md          # Full documentation
```

---

## 🚀 Next Steps

Once this works, you can easily add:
- Anthropic (Claude)
- Ollama (local LLMs)
- Custom system prompts
- Model switching in the UI

---

## ⚠️ Important Notes

1. **API Keys**: Never commit `.env.local` to git
2. **Costs**: gpt-4o-mini is ~$0.15-0.60 per 1M tokens (very cheap)
3. **Rate Limits**: Free tier has lower limits, upgrade if needed

Enjoy your AI-powered chat! 🎉
