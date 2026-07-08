# InstiGPT v2

Intelligent campus assistant for IIT Bombay — powered by RAG (hybrid vector + knowledge graph search), Groq (Llama 3.1), and real-time web search.

## Architecture

```
Frontend (Next.js 15)  →  API (Hono.js / Cloudflare Workers)  →  Supabase (pgvector + graph)
     Vercel                        Edge                              Postgres
                                     ↓
                              Groq (Llama 3.1 70B)
                              Cloudflare AI (embeddings)
                              DuckDuckGo (web search)
```

## Stack

| Layer | Technology | Hosting |
|---|---|---|
| Frontend | Next.js 15, Tailwind, PWA | Vercel (free) |
| API | Hono.js, TypeScript | Cloudflare Workers (free) |
| LLM | Groq (Llama 3.1 70B) | Free tier |
| Embeddings | BGE Base v1.5 via CF Workers AI | Free |
| Database | Supabase (Postgres + pgvector) | Free 500MB |
| Web Search | DuckDuckGo | Free |
| Auth | IIT Bombay Gymkhana SSO | — |

## Project Structure

```
instigpt/
├── apps/
│   ├── api/            # Hono.js API (Cloudflare Workers)
│   └── web/            # Next.js frontend (Vercel)
├── packages/
│   └── shared/         # Shared TypeScript types
├── scripts/
│   └── embed.py        # One-time embedding pipeline (Python)
├── supabase/
│   └── migrations/     # Database schema
├── data/               # Source documents (PDFs, JSONs, CSVs)
└── pnpm-workspace.yaml
```

## Quick Start

### Prerequisites

- Node.js 22+
- pnpm (`npm i -g pnpm`)
- Python 3.10+ (for embedding pipeline only)
- Accounts: [Supabase](https://supabase.com), [Groq](https://console.groq.com), [Cloudflare](https://dash.cloudflare.com)

### 1. Install dependencies

```bash
pnpm install
```

### 2. Setup environment

```bash
cp .env.example .env
# Fill in your keys
```

### 3. Setup database

Run the migration SQL in your Supabase SQL Editor:
- Go to Supabase Dashboard → SQL Editor
- Paste contents of `supabase/migrations/001_initial_schema.sql`
- Execute

### 4. Embed documents

```bash
cd scripts
pip install -r requirements.txt
python embed.py
```

### 5. Run locally

```bash
# API (runs on :8787)
pnpm dev:api

# Frontend (runs on :3000)
pnpm dev:web
```

### 6. Deploy

```bash
# API → Cloudflare Workers
pnpm deploy:api

# Frontend → Vercel
# Connect the apps/web directory to Vercel
```

## Features

- **Streaming responses** — real-time token streaming via SSE
- **Hybrid RAG** — vector search + keyword search + knowledge graph
- **Personalized** — knows your department/year from roll number
- **Web augmented** — falls back to DuckDuckGo for fresh info
- **PWA** — installable on mobile like a native app
- **Edge-first** — API runs globally on Cloudflare's edge network (0ms cold start)

## Team

Built by the InstiGPT Team, IIT Bombay.
