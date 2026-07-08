# InstiGPT v2 — Project Status

## Current State

The full monorepo is scaffolded, all packages typecheck and build, and the frontend is live in dev mode with mock auth.

---

## What's Implemented

### Frontend (`apps/web/`) — DONE

| Feature | Status |
|---|---|
| Next.js 15 + React 19 | Done |
| Dark theme (Supabase-inspired) | Done |
| Responsive design (mobile/tablet/desktop) | Done |
| Streaming chat UI with SSE parsing | Done |
| Message animations (Framer Motion) | Done |
| Sidebar with conversation history | Done |
| Profile page (`/profile`) | Done |
| Settings page (`/settings`) | Done |
| Login page (`/login`) | Done |
| Profile dropdown menu (top-right) | Done |
| Source citations (expandable per message) | Done |
| Thumbs up/down feedback | Done |
| PWA install prompt | Done |
| Keyboard shortcuts (Cmd+K, Cmd+B, Cmd+Shift+N) | Done |
| Toast notifications (sonner) | Done |
| Dev mode mock auth | Done |
| Safe-area insets (iOS PWA) | Done |
| Auto-resize textarea | Done |
| Markdown rendering with syntax highlighting | Done |

### API (`apps/api/`) — DONE (code complete, not deployed)

| Feature | Status |
|---|---|
| Hono.js on Cloudflare Workers | Done |
| Hexagonal architecture (domain/infra/http) | Done |
| SSO auth flow (login/logout/me) | Done |
| Session-based auth middleware | Done |
| Conversation CRUD endpoints | Done |
| Streaming chat endpoint (SSE) | Done |
| Hybrid search (vector + keyword + graph) | Done |
| DuckDuckGo web search fallback | Done |
| Cloudflare AI embeddings (BGE base) | Done |
| Groq LLM integration (Llama 3.1 70B) | Done |
| Question condensing for follow-ups | Done |
| Personalized system prompt (dept/year) | Done |
| Typed config layer | Done |
| Error handling | Done |

### Database (`supabase/migrations/`) — DONE (not yet executed)

| Feature | Status |
|---|---|
| Users table | Done |
| Sessions table | Done |
| Conversations + Messages tables | Done |
| Chunks table with pgvector (768-dim) | Done |
| Entities table (knowledge graph nodes) | Done |
| Relationships table (knowledge graph edges) | Done |
| Vector similarity search function | Done |
| Full-text keyword search function | Done |
| Entity fuzzy search function | Done |
| HNSW index for fast ANN | Done |
| Row Level Security policies | Done |

### Embedding Pipeline (`scripts/embed.py`) — DONE (not yet run)

| Feature | Status |
|---|---|
| PDF loader + chunker | Done |
| JSON loader + chunker | Done |
| CSV loader + chunker | Done |
| Text file loader | Done |
| BGE base embeddings (sentence-transformers) | Done |
| LLM-based entity extraction (Groq) | Done |
| Relationship extraction | Done |
| Batch upload to Supabase | Done |
| Progress indicators (rich) | Done |

### Shared Types (`packages/shared/`) — DONE

| Feature | Status |
|---|---|
| User, Session, Conversation, Message types | Done |
| Entity, Relationship, Chunk types | Done |
| API request/response types | Done |
| Roll number parser (dept/year/program) | Done |

---

## What's NOT Done Yet

### Phase 1: Get it actually working (Today/Tomorrow)

| Task | Effort | What to do |
|---|---|---|
| Run Supabase migration | 5 min | Paste SQL into Supabase SQL Editor |
| Create `.env` file | 2 min | Copy `.env.example`, fill in keys |
| Create `apps/api/.dev.vars` | 2 min | Copy `.dev.vars.example`, fill in keys |
| Run embedding pipeline | 10-30 min | `cd scripts && pip install -r requirements.txt && python embed.py` |
| Test API locally | 5 min | `pnpm dev:api` → test with curl |
| Test full flow (frontend + API) | 10 min | Both running, send a message |
| Deploy API to Cloudflare | 10 min | `wrangler login && pnpm deploy:api` + set secrets |
| Deploy frontend to Vercel | 10 min | Connect repo, set env vars |

### Phase 2: Polish & Features (This Week)

| Task | Effort |
|---|---|
| Wire up feedback (store thumbs up/down in DB) | 1 hr |
| Export conversations as JSON (settings page) | 1 hr |
| Clear all conversations (settings page) | 30 min |
| Delete individual conversations (sidebar swipe/button) | 1 hr |
| Rename conversations | 30 min |
| Auto-title conversations from first message | 30 min |
| Error boundary (graceful crash handling) | 30 min |
| Rate limiting on chat endpoint | 1 hr |
| Add more source documents to data/ | Ongoing |

### Phase 3: Standout Features (Next 2 Weeks)

| Task | Effort |
|---|---|
| Course planner agent (structured UG Rulebook data) | 3-4 days |
| Mess menu scraper (OCR from WhatsApp images) | 2 days |
| Real SSO integration (with Gymkhana) | 1 day |
| WhatsApp bot (Twilio sandbox) | 2 days |
| Community contributions (submit Q&A pairs) | 2-3 days |
| Voice input (Web Speech API) | 1 day |
| Image upload (Gemini multimodal) | 1-2 days |
| Push notifications (PWA) | 1 day |
| Analytics dashboard (PostHog) | 1 day |
| Confidence scoring on answers | 1 day |

---

## Next Steps (Do These In Order)

### Step 1: Run the database migration

1. Go to https://supabase.com/dashboard/project/qmsvchezcyhftkunnvoa
2. Click **SQL Editor** in the left sidebar
3. Paste the entire contents of `supabase/migrations/001_initial_schema.sql`
4. Click **Run**
5. Verify tables appear in Table Editor

### Step 2: Set up environment variables

```bash
# Root .env (used by embedding pipeline)
cp .env.example .env
# Fill in: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GROQ_API_KEY

# API .dev.vars (used by wrangler dev)
cp apps/api/.dev.vars.example apps/api/.dev.vars
# Fill in same keys + SSO keys (can leave SSO blank for now)
```

### Step 3: Run the embedding pipeline

```bash
cd scripts
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python embed.py
```

This will take 10-30 minutes depending on your internet (downloads the BGE model on first run). It will:
- Load all PDFs/JSONs/CSVs from `data/`
- Chunk them into ~1000 char pieces
- Extract entities + relationships using Groq
- Embed everything with BGE
- Upload to Supabase

### Step 4: Test the API locally

```bash
pnpm dev:api
# In another terminal:
curl http://localhost:8787/
# Should return: {"status":"ok","service":"instigpt-api","version":"2.0.0"}
```

### Step 5: Test the full flow

1. Keep API running on :8787
2. Frontend is already on :3000
3. Type a question and hit Enter
4. You should see streaming tokens appear

### Step 6: Deploy

```bash
# API → Cloudflare Workers
cd apps/api
wrangler login
wrangler secret put GROQ_API_KEY
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_ANON_KEY
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
pnpm deploy

# Frontend → Vercel
# Go to vercel.com, import the repo
# Set root directory to apps/web
# Set NEXT_PUBLIC_API_URL to your workers URL
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ Frontend (Next.js 15 on Vercel)                              │
│ /login, /, /profile, /settings                               │
│ Streaming SSE, Framer Motion, PWA                            │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS + SSE
┌──────────────────────▼──────────────────────────────────────┐
│ API (Hono.js on Cloudflare Workers)                          │
│                                                              │
│  domain/     Pure business logic (chat orchestration)        │
│  infra/      Adapters (Groq, Supabase, CF AI, DuckDuckGo)   │
│  http/       Thin route handlers                             │
└───────┬────────────┬────────────┬────────────┬──────────────┘
        │            │            │            │
   ┌────▼───┐  ┌────▼───┐  ┌────▼───┐  ┌────▼───┐
   │Supabase│  │  Groq  │  │  CF AI │  │  DDG   │
   │Postgres│  │Llama3.1│  │BGE emb │  │Search  │
   │pgvector│  │  70B   │  │  768d  │  │  free  │
   │ + graph│  │  free  │  │  free  │  │        │
   └────────┘  └────────┘  └────────┘  └────────┘
```

---

## File Structure

```
instigpt/
├── apps/
│   ├── api/                    # Hono.js API (Cloudflare Workers)
│   │   ├── src/
│   │   │   ├── config/         # Centralized env config
│   │   │   ├── domain/         # Pure business logic
│   │   │   │   ├── chat/       # Chat orchestration (ports + service)
│   │   │   │   ├── conversation/
│   │   │   │   └── user/
│   │   │   ├── http/           # Thin controllers
│   │   │   │   ├── middleware/ # Auth middleware
│   │   │   │   └── routes/     # auth, chat, conversations
│   │   │   ├── infra/          # External service adapters
│   │   │   │   ├── auth/       # SSO adapter
│   │   │   │   ├── db/         # Supabase repositories
│   │   │   │   ├── embeddings/ # Cloudflare Workers AI
│   │   │   │   ├── llm/        # Groq adapter
│   │   │   │   └── search/     # Hybrid search + DuckDuckGo
│   │   │   └── lib/            # Utilities
│   │   └── wrangler.toml
│   └── web/                    # Next.js frontend (Vercel)
│       └── src/
│           ├── app/            # Pages (/, /login, /profile, /settings)
│           ├── components/     # UI components
│           │   ├── chat/       # ChatMessage, ChatInput
│           │   ├── feedback/   # MessageFeedback
│           │   ├── layout/     # Sidebar, ProfileMenu, KeyboardShortcuts
│           │   ├── onboarding/ # InstallPrompt
│           │   ├── sources/    # SourceCitations
│           │   └── ui/         # Primitives (IconButton, LoadingDots)
│           ├── config/         # Environment config
│           ├── hooks/          # useChat, useAuth
│           └── lib/            # API client, SSE parser
├── packages/
│   └── shared/                 # Shared TypeScript types
├── scripts/
│   ├── embed.py               # One-time embedding pipeline
│   └── requirements.txt
├── supabase/
│   └── migrations/            # Database schema
├── data/                      # Source documents
└── .env.example
```

---

## Tech Stack Summary

| Layer | Tech | Version | Cost |
|---|---|---|---|
| Runtime | Node.js | 24.15.0 | — |
| Package Manager | pnpm | 11.10.0 | — |
| Language | TypeScript | 5.9.3 | — |
| Frontend | Next.js | 15.5.20 | Free (Vercel) |
| UI | React | 19.2.7 | — |
| Styling | Tailwind CSS | 3.4.19 | — |
| Animation | Motion (Framer) | 12.42.2 | — |
| API | Hono.js | 4.12.28 | Free (CF Workers) |
| LLM | Groq (Llama 3.1 70B) | — | Free tier |
| Embeddings | CF Workers AI (BGE) | — | Free |
| Database | Supabase (Postgres) | — | Free 500MB |
| Vector Search | pgvector | — | Included |
| Web Search | DuckDuckGo | — | Free |
| Hosting (FE) | Vercel | — | Free |
| Hosting (API) | Cloudflare Workers | — | Free 100k req/day |

**Total monthly cost: $0**
