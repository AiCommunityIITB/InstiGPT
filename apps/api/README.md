# InstiGPT API

The backend for InstiGPT. Runs on Cloudflare Workers with Hono.js.

**Live:** https://instigpt-api.instigpt.workers.dev

## Architecture

Hexagonal (ports and adapters). The idea is simple: business logic lives in `domain/`, external services live in `infra/`, and the HTTP layer is just thin glue.

```
src/
├── index.ts              # Entry point, exports the Hono app
├── types.ts              # Cloudflare Worker env bindings + user context type
├── config/               # Reads env vars into a typed Config object
├── domain/               # Pure business logic (no I/O imports)
│   ├── chat/
│   │   ├── service.ts    # Chat orchestration: condense, retrieve, stream, save
│   │   ├── rag.ts        # RAG pipeline: route, expand, fuse, score, optimize
│   │   └── index.ts      # Re-exports
│   ├── conversation/     # Conversation CRUD interface
│   └── user/             # User + session interfaces
├── http/                 # Request handling
│   ├── app.ts            # Creates the Hono app, mounts routes
│   ├── middleware/
│   │   ├── auth.ts       # Session validation + anonymous mode
│   │   └── rateLimit.ts  # Sliding window rate limiter
│   └── routes/
│       ├── auth.ts       # Login, signup, logout, me
│       ├── chat.ts       # POST /chat (SSE streaming)
│       ├── conversations.ts  # CRUD for conversation history
│       └── feedback.ts   # POST /feedback (thumbs up/down)
├── infra/                # External service adapters
│   ├── auth/sso.ts       # IIT Bombay Gymkhana SSO OAuth flow
│   ├── cache/semantic.ts # Semantic cache (pgvector similarity)
│   ├── db/supabase.ts    # All Supabase repos (users, sessions, conversations, messages)
│   ├── embeddings/cloudflare.ts  # BGE embeddings (CF Workers AI + local fallback)
│   ├── llm/gemini.ts     # Gemini Flash adapter (primary)
│   ├── llm/groq.ts       # Groq/Llama adapter (backup)
│   └── search/
│       ├── hybrid.ts     # Vector + keyword + knowledge graph search
│       └── web.ts        # DuckDuckGo web search fallback
└── lib/utils.ts          # Retry helper, exhaustive match
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | No | Health check |
| POST | `/auth/login` | No | Email/password login |
| POST | `/auth/signup` | No | Create account |
| POST | `/auth/logout` | Yes | Destroy session |
| GET | `/auth/me` | Yes | Current user info |
| POST | `/chat` | Yes* | Stream a chat response (SSE) |
| GET | `/conversations` | Yes | List user's conversations |
| POST | `/conversations` | Yes | Create a conversation |
| GET | `/conversations/:id/messages` | Yes | Get messages for a conversation |
| PATCH | `/conversations/:id` | Yes | Rename a conversation |
| DELETE | `/conversations/:id` | Yes | Delete a conversation |
| POST | `/feedback` | Yes* | Submit thumbs up/down |

*Anonymous users get 5 free requests before needing to sign up.

## SSE Events (POST /chat)

The chat endpoint returns a streaming SSE response with these event types:

| Event | Payload | When |
|-------|---------|------|
| `metadata` | `{ conversation_id }` | Immediately (tells frontend which conversation this belongs to) |
| `sources` | Array of source objects | After retrieval, before LLM starts |
| `token` | String (partial text) | Each token as LLM generates it |
| `done` | `{}` | LLM finished generating |
| `title` | `{ title }` | After first exchange (auto-generated title) |
| `followups` | Array of 3 question strings | After done (suggested next questions) |
| `error` | `{ error }` | If something breaks |

## RAG Pipeline (domain/chat/rag.ts)

The retrieval pipeline runs in this order:

1. **Route** the query (knowledge, web, conversational, fun, meta)
2. **Expand** the query into 2-3 search variants (1 LLM call for complex queries)
3. **Retrieve** in parallel: vector search (each variant) + web search
4. **Fuse** results with Reciprocal Rank Fusion (k=60)
5. **Re-rank** with heuristic cross-encoder (term overlap, bigram match, position weighting)
6. **Score confidence** (high/medium/low/none based on term coverage)
7. **Optimize** for context window (budget allocation based on confidence)

## Rate Limiting

In-memory sliding window. 15 messages per minute per user. Returns 429 with headers:
- `X-RateLimit-Limit: 15`
- `X-RateLimit-Remaining: N`
- `X-RateLimit-Reset: <unix timestamp>`

## Semantic Cache

Before running RAG, the query embedding is compared against recent cached responses (cosine similarity > 0.98). Cache entries expire after 24 hours. This saves LLM tokens for repeated/near-identical questions.

## Local Development

```bash
# From the api directory
pnpm dev

# This starts wrangler dev on http://localhost:8787
# Auth is bypassed in dev mode (you get a fake "Dev User")
# Needs the local embedding server running for vector search:
# cd scripts && python embed_server.py
```

## Deploying

```bash
npx wrangler deploy

# Secrets (set once)
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

## Swapping LLM Providers

The domain layer depends on `LLMPort` (interface), not a specific provider. To switch:

1. Create a new adapter in `infra/llm/` implementing `LLMPort`
2. Change one line in `http/routes/chat.ts` where deps are wired up

Currently available: `createGeminiLLM()`, `createGroqLLM()`.
