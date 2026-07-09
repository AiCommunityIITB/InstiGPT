# Scripts

Data processing scripts for InstiGPT. These run once (or when data changes), not at runtime.

## embed.py

The main embedding pipeline. Takes all documents from `data/` and uploads them to Supabase as searchable vector chunks.

What it does:
1. Loads every PDF, JSON, CSV, and text file from `data/`
2. Chunks them into overlapping segments (600-1200 chars depending on document type)
3. Adds context prefixes so the embedding model knows what each chunk is about
4. Generates 768-dim vectors using BGE Base v1.5 (runs locally via sentence-transformers)
5. Uploads chunks + embeddings to Supabase in batches of 50

```bash
cd scripts
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python embed.py
```

Takes 5-10 minutes on first run (downloads the 420MB BGE model). Subsequent runs are faster.

## scrape.py

Web scraper for IIT Bombay department websites. Reads URLs from `data/urls/` and downloads page content into `data/scraped/`.

```bash
python scrape.py              # Scrape everything
python scrape.py --limit 50   # Only 50 pages (for testing)
```

Output goes to `data/scraped/` as JSON files. These get picked up by `embed.py`.

## embed_server.py

A tiny HTTP server that wraps the BGE embedding model. Used during local development so the API can generate embeddings without Cloudflare Workers AI.

```bash
python embed_server.py
# Runs on http://localhost:9999
# POST with { "text": "..." } -> returns { "embedding": [...768 floats...] }
```

In production, the API uses Cloudflare Workers AI instead (the `@cf/baai/bge-base-en-v1.5` binding). This server is only needed for `pnpm dev:api`.

## requirements.txt

Python dependencies for all three scripts. Install once in a virtualenv:
```bash
pip install -r requirements.txt
```
