# InstiGPT v2

An AI campus assistant for IIT Bombay students. Ask it anything about courses, profs, hostels, placements, clubs, rules, or campus life. It uses RAG (retrieval augmented generation) to answer from actual IITB documents, and falls back to web search when needed.

**Live at:** https://insti-gpt-web.vercel.app

## How it works

1. User asks a question
2. The query gets classified (knowledge lookup, web search, fun/roast, conversational)
3. For knowledge queries: the question is embedded, and we run hybrid search (vector + keyword + knowledge graph) against our document database
4. Results are fused using Reciprocal Rank Fusion and re-ranked
5. The top sources + question go to the LLM which streams back an answer
6. Sources are shown alongside the answer for transparency

```
User -> Next.js (Vercel) -> Hono API (Cloudflare Workers) -> Supabase (pgvector)
                                   |                              |
                                   v                              v
                            Gemini Flash (LLM)           768-dim embeddings
                            DuckDuckGo (web)             Knowledge graph
```

## Live URLs

| Service | URL |
|---------|-----|
| Frontend | https://insti-gpt-web.vercel.app |
| API | https://instigpt-api.instigpt.workers.dev |
| Database | https://qmsvchezcyhftkunnvoa.supabase.co |

## Tech stack

| Layer | What we use | Why |
|-------|-------------|-----|
| Frontend | Next.js 15, React 19, Tailwind | Fast, dark themed, works as a PWA |
| API | Hono.js on Cloudflare Workers | Zero cold start, free tier is generous |
| LLM | Gemini Flash Lite (primary), Groq/Llama as backup | Free tier, fast streaming |
| Embeddings | Cloudflare Workers AI (BGE Base v1.5, 768-dim) | Runs at the edge, free |
| Database | Supabase Postgres + pgvector | Vector search + regular SQL in one place |
| Web search | DuckDuckGo API | Free, no key needed |

Total cost: $0/month on free tiers.

## Project structure

```
instigpt/
├── apps/
│   ├── api/                 # Hono.js backend (Cloudflare Workers)
│   │   └── src/
│   │       ├── config/      # Environment and config management
│   │       ├── domain/      # Business logic (chat orchestration, RAG pipeline)
│   │       ├── http/        # Routes and middleware (thin controllers)
│   │       ├── infra/       # External service adapters (LLM, DB, search, cache)
│   │       └── lib/         # Shared utilities
│   └── web/                 # Next.js frontend (Vercel)
│       └── src/
│           ├── app/         # Pages (chat, login, profile, settings)
│           ├── components/  # UI components (chat, layout, feedback, sources)
│           ├── hooks/       # useChat (streaming), useAuth (session management)
│           ├── lib/         # API client, SSE parser
│           └── config/      # Environment config
├── packages/
│   └── shared/              # TypeScript types shared between frontend and API
├── scripts/
│   ├── embed.py             # One-time embedding pipeline (chunks + embeds documents)
│   ├── scrape.py            # Web scraper for IITB department sites
│   └── embed_server.py      # Local embedding server for dev mode
├── supabase/
│   └── migrations/          # Database schema (3 migrations)
├── data/                    # Source documents (PDFs, JSONs, CSVs, scraped pages)
└── pnpm-workspace.yaml
```

## Running locally

### Prerequisites

- Node.js 24+
- pnpm (`npm i -g pnpm`)
- Python 3.10+ (only for the embedding pipeline)

### Setup

```bash
# Install dependencies
pnpm install

# Create env files
cp .env.example .env
cp apps/api/.dev.vars.example apps/api/.dev.vars
# Fill in your Supabase and Groq/Gemini keys

# Start the embedding server (needed for local vector search)
cd scripts && python embed_server.py &

# Run both frontend and API
pnpm dev
```

Frontend runs on http://localhost:3000, API on http://localhost:8787.

In dev mode, auth is bypassed automatically (you get a fake "Dev User" session).

### Running the embedding pipeline

This only needs to happen once (or when you add new documents to `data/`):

```bash
cd scripts
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python embed.py
```

Takes about 5-10 minutes. It chunks all PDFs/JSONs/CSVs, generates embeddings with BGE, and uploads everything to Supabase.

## Deploying

### API (Cloudflare Workers)

```bash
cd apps/api
npx wrangler deploy

# Set secrets (one time)
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put SUPABASE_ANON_KEY
```

### Frontend (Vercel)

Connected via GitHub integration. Push to `main` and Vercel auto-deploys.

Settings in Vercel:
- Root directory: `apps/web`
- Framework: Next.js
- Environment variable: `NEXT_PUBLIC_API_URL=https://instigpt-api.instigpt.workers.dev`

### Database migrations

Run in Supabase SQL Editor (Dashboard > SQL Editor > paste and run):
1. `supabase/migrations/001_initial_schema.sql` (tables, indexes, search functions)
2. `supabase/migrations/002_add_password_hash.sql` (email/password auth support)
3. `supabase/migrations/003_feedback_and_cache.sql` (feedback + semantic cache)

## Features

**Chat:**
- Streaming responses with SSE (tokens appear in real time)
- Hybrid RAG: vector similarity + full-text keyword + knowledge graph lookup
- Query routing (knowledge, web search, conversational, fun/roast modes)
- Reciprocal Rank Fusion for merging search results
- Confidence scoring (only shows sources when retrieval is confident)
- Follow-up question suggestions after each answer
- Auto-generated conversation titles
- Inline source citations [Like This]

**Frontend:**
- Dark themed (inspired by Supabase/Vercel aesthetic)
- PWA installable on mobile
- Keyboard shortcuts (Cmd+K focus, Cmd+B sidebar, Cmd+Shift+N new chat)
- Conversation history with sidebar
- Source citations expandable per message
- Thumbs up/down feedback (persisted)
- Error boundary with recovery

**Infrastructure:**
- Semantic cache (avoids re-running RAG for near-identical questions)
- Rate limiting (15 msgs/min per user)
- Anonymous mode (5 free messages without signup)
- Session-based auth with SSO support

## Data sources

The knowledge base includes:
- UG Rulebook (academic rules, branch change, CPI requirements)
- Bluebook (the comprehensive student guide)
- Course data from Resobin (8000+ courses with reviews and grades)
- DAMP guides (department mentorship program resources)
- Apping guides (internship and placement preparation)
- SAC Constitution
- ITC reports (Inter-IIT, Techfest, cultural activities)
- Department websites (scraped)
- Hostel information
- Grade distributions

## Architecture decisions

**Why hexagonal architecture for the API?**
The domain logic (chat orchestration, RAG pipeline) is separated from infrastructure (Supabase, Gemini, Cloudflare AI). This means we can swap LLM providers, databases, or search backends without touching business logic.

**Why Cloudflare Workers over AWS Lambda?**
Zero cold starts, free tier of 100k requests/day, and the AI binding gives us free embeddings at the edge.

**Why not use a vector DB like Pinecone?**
Supabase gives us pgvector + regular SQL in one place. We need relational data (users, conversations, messages) alongside vectors. One fewer service to manage.

**Why Gemini over GPT-4 or Claude?**
Free tier with good instruction following. The API is designed with ports so swapping is one line.

## Team

Built by the InstiGPT Team at the AI Community, IIT Bombay.
