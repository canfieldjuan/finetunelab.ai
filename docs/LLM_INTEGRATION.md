# LLM Integration Guide

## OpenAI Integration (Active)

This application now uses OpenAI's GPT models for chat completions with real-time streaming support.

### Setup

1. **Get your OpenAI API key**
   - Go to <https://platform.openai.com/api-keys>
   - Create a new API key
   - Copy the key

2. **Configure environment variables**
   - Copy `.env.local.example` to `.env.local`
   - Add your OpenAI API key:

     ```bash
     OPENAI_API_KEY=sk-...your-key-here...
     ```

3. **Restart your development server**

   ```bash
   npm run dev
   ```

### Configuration

Edit `config/llm.yaml` to customize:

```yaml
openai:
  model: gpt-4o-mini  # Options: gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo
  temperature: 0.7    # 0.0 = deterministic, 1.0 = creative
  max_tokens: 2000    # Maximum response length
  stream: true        # Enable streaming responses
```

### Features

- ✅ **Real-time streaming** - See AI responses appear token by token
- ✅ **Conversation history** - Full context sent to the model
- ✅ **Database persistence** - All messages saved to Supabase
- ✅ **Error handling** - Graceful fallbacks on API errors
- ✅ **Modern UI** - Clean, professional chat interface

### Models

**Recommended for production:**

- `gpt-4o-mini` - Fast, cost-effective, great for most use cases
- `gpt-4o` - Most capable, slower, more expensive

**Development/testing:**

- `gpt-3.5-turbo` - Fastest, cheapest, good for testing

### API Costs (Approximate)

- **gpt-4o-mini**: $0.15 per 1M input tokens, $0.60 per 1M output tokens
- **gpt-4o**: $2.50 per 1M input tokens, $10.00 per 1M output tokens
- **gpt-3.5-turbo**: $0.50 per 1M input tokens, $1.50 per 1M output tokens

### Future Providers

The architecture supports easy addition of:

- Anthropic (Claude)
- Ollama (Local LLMs)
- Other OpenAI-compatible APIs

---

## Troubleshooting

**"Failed to get AI response"**

- Check your API key is set correctly in `.env.local`
- Verify you have credits in your OpenAI account
- Check browser console for detailed error messages

**Streaming not working**

- Make sure `stream: true` in `config/llm.yaml`
- Check network tab for SSE connection
- Try refreshing the page

**Responses are slow**

- Consider switching to `gpt-4o-mini` or `gpt-3.5-turbo`
- Reduce `max_tokens` in config
- Check your internet connection
