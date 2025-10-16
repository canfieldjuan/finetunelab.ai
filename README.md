# Web UI - AI-Powered Chat with GraphRAG

A [Next.js](https://nextjs.org) application featuring AI-powered chat with Graph Retrieval-Augmented Generation (GraphRAG), multi-provider LLM support, and intelligent tool calling.

## Features

- **Multi-Provider LLM Support**: OpenAI, Anthropic Claude, and Ollama (local models)
- **GraphRAG Integration**: Knowledge graph-based context retrieval using Neo4j and Graphiti
- **Intelligent Tool Calling**: Calculator, datetime, and web search capabilities
- **Query Classification**: Smart routing to prevent unnecessary graph searches
- **Real-time Streaming**: Progressive response rendering
- **Persistent Conversations**: Supabase integration for chat history

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env` file in the project root (see `OPENAI_SETUP.md` for quick setup):

```bash
# LLM Provider (openai, anthropic, ollama)
LLM_PROVIDER=openai

# OpenAI Configuration
OPENAI_API_KEY=sk-proj-your-key-here
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=2000
OPENAI_STREAM=true

# Neo4j (for GraphRAG)
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password
NEO4J_DATABASE=neo4j

# Supabase (for conversation storage)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-key
```

For complete configuration including Anthropic and Ollama, see:
- **Quick Setup**: `OPENAI_SETUP.md`
- **Complete Guide**: `docs/LLM_CONFIGURATION_GUIDE.md`

### 3. Start Services

**Neo4j Database:**
```bash
docker run -d \
  --name neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/your-password \
  neo4j:latest
```

**Graphiti API:**
```bash
cd graphiti-wrapper
bash start_graphiti_server.sh
```

**Web UI:**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Project Structure

```
web-ui/
├── app/                        # Next.js App Router
│   ├── api/chat/              # Chat API endpoint with streaming
│   └── page.tsx               # Main chat interface
├── lib/
│   ├── config/                # Configuration loaders
│   │   └── llmConfig.ts       # LLM provider configuration
│   ├── graphrag/              # GraphRAG implementation
│   │   ├── service/           # GraphRAG orchestration
│   │   └── utils/             # Query classification
│   ├── llm/                   # LLM provider integrations
│   │   ├── openai.ts
│   │   ├── anthropic.ts
│   │   └── ollama.ts
│   └── tools/                 # Tool calling implementations
│       ├── calculator/
│       ├── datetime/
│       └── web-search/
├── graphiti-wrapper/          # Python Graphiti API
└── docs/                      # Documentation
    ├── LLM_CONFIGURATION_GUIDE.md
    ├── LLM_INTEGRATION.md
    └── GRAPHRAG_UI_INTEGRATION.md
```

## Configuration

### LLM Providers

Switch providers by changing `LLM_PROVIDER` in `.env`:

```bash
LLM_PROVIDER=openai      # Use OpenAI GPT models
LLM_PROVIDER=anthropic   # Use Anthropic Claude models
LLM_PROVIDER=ollama      # Use local Ollama models
```

See `docs/LLM_CONFIGURATION_GUIDE.md` for complete provider setup instructions.

### GraphRAG Configuration

GraphRAG automatically enhances queries with relevant context from the knowledge graph:

- **Query Classification**: Math, datetime, and web search queries skip graph lookup
- **Confidence Filtering**: Only high-confidence results (>0.7) are used
- **Smart Context**: Relevant entities and relationships enrich LLM prompts

Configuration in `lib/graphrag/config.ts`.

## Development

### Run Tests

```bash
# Query classifier tests
npm test lib/graphrag/utils/query-classifier.test.ts

# All tests
npm test
```

### Build for Production

```bash
npm run build
npm start
```

### Type Checking

```bash
npx tsc --noEmit
```

## Documentation

- **Quick Setup**: `OPENAI_SETUP.md`
- **LLM Configuration**: `docs/LLM_CONFIGURATION_GUIDE.md`
- **GraphRAG Integration**: `docs/GRAPHRAG_UI_INTEGRATION.md`
- **Implementation Logs**: `docs/LLM_CONFIG_UNIFICATION_COMPLETE.md`

## Architecture

Built with Next.js 15.5.4 using:
- **App Router**: Server and client components
- **Streaming**: Real-time response rendering
- **Tool Calling**: Function execution with LLM orchestration
- **GraphRAG**: Knowledge graph context enhancement
- **TypeScript**: Full type safety

## Next.js Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)
- [Next.js GitHub](https://github.com/vercel/next.js)

## License

MIT
