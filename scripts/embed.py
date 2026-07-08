"""
InstiGPT Embedding Pipeline (Fast Mode)
Chunks documents, embeds with BGE, uploads to Supabase.
Skips entity extraction for speed — run separately later.

Expected time: 3-5 minutes (includes ~1 min model download on first run)
"""

import os
import json
import csv
from pathlib import Path

from dotenv import load_dotenv
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn
from supabase import create_client
from sentence_transformers import SentenceTransformer
from langchain_text_splitters import RecursiveCharacterTextSplitter

load_dotenv(Path(__file__).parent.parent / ".env")

console = Console()

# Config
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
DATA_DIR = Path(__file__).parent.parent / "data"
BATCH_SIZE = 50

# Dynamic chunk sizes by document type
CHUNK_CONFIGS = {
    "pdf_dense": {"chunk_size": 600, "chunk_overlap": 150},   # Rulebooks, constitutions (dense rules)
    "pdf_normal": {"chunk_size": 1000, "chunk_overlap": 200}, # General PDFs
    "scraped": {"chunk_size": 1200, "chunk_overlap": 250},    # Web pages (info is spread out)
    "json_courses": {"chunk_size": 800, "chunk_overlap": 100},# Course data (structured)
    "csv": {"chunk_size": 800, "chunk_overlap": 100},         # CSV data
    "default": {"chunk_size": 1000, "chunk_overlap": 200},    # Fallback
}

# Document type → context prefix mapping
CONTEXT_PREFIXES = {
    "ugrulebook": "IIT Bombay UG Rulebook — Academic Rules and Regulations",
    "Bluebook": "IIT Bombay Blue Book — Student Guide",
    "SAC-Constitution": "Student Activity Centre Constitution",
    "Course Info": "IIT Bombay Course Information",
    "Apping Guide": "Internship and Placement Application Guide",
    "Non-Core Apping": "Non-Core Apping Guide for IITB Students",
    "Hostel": "IIT Bombay Hostel Information",
    "Updated_DD_Curriculum": "Dual Degree Curriculum Guide",
    "MInDS Minor": "CMInDS Minor Degree Information",
    "resobin_courses": "ResoBin Course Reviews and Information",
    "grades": "IIT Bombay Course Grades Data",
    "itc": "Inter-IIT Tech Council",
}

def get_chunk_config(file_path: Path, file_type: str) -> dict:
    """Determine chunk size based on document type."""
    name = file_path.stem.lower()
    if file_type == "scraped":
        return CHUNK_CONFIGS["scraped"]
    if file_type == "csv":
        return CHUNK_CONFIGS["csv"]
    if file_type == "json" and ("resobin" in name or "course" in name):
        return CHUNK_CONFIGS["json_courses"]
    if file_type == "pdf" and any(k in name for k in ["rulebook", "constitution", "curriculum"]):
        return CHUNK_CONFIGS["pdf_dense"]
    if file_type == "pdf":
        return CHUNK_CONFIGS["pdf_normal"]
    return CHUNK_CONFIGS["default"]

def get_context_prefix(source: str) -> str:
    """Get a contextual prefix for a chunk based on its source."""
    for key, prefix in CONTEXT_PREFIXES.items():
        if key.lower() in source.lower():
            return prefix
    return ""

# Init
console.print("[bold]Loading embedding model...[/bold]")
embedding_model = SentenceTransformer("BAAI/bge-base-en-v1.5")
console.print("[green]Model loaded.[/green]")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
    separators=["\n\n", "\n", ". ", " ", ""],
)

def make_splitter(config: dict) -> RecursiveCharacterTextSplitter:
    return RecursiveCharacterTextSplitter(
        chunk_size=config["chunk_size"],
        chunk_overlap=config["chunk_overlap"],
        separators=["\n\n", "\n", ". ", " ", ""],
    )


def embed_texts(texts: list[str]) -> list[list[float]]:
    embeddings = embedding_model.encode(texts, normalize_embeddings=True)
    return embeddings.tolist()


def load_pdf(path: Path) -> list[dict]:
    from pypdf import PdfReader
    reader = PdfReader(str(path))
    full_text = ""
    for page in reader.pages:
        text = page.extract_text()
        if text:
            full_text += text + "\n\n"
    config = get_chunk_config(path, "pdf")
    splitter = make_splitter(config)
    chunks = splitter.split_text(full_text)
    prefix = get_context_prefix(path.stem)
    return [{"content": f"[{prefix}] {c}" if prefix else c, "source": path.stem, "metadata": {"type": "pdf", "file": path.name}} for c in chunks if c.strip()]


def load_json_file(path: Path) -> list[dict]:
    with open(path) as f:
        data = json.load(f)
    chunks = []

    # Handle scraped content format (from scrape.py)
    if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict) and "content" in data[0] and "url" in data[0]:
        config = get_chunk_config(path, "scraped")
        splitter = make_splitter(config)
        for page in data:
            content = page.get("content", "")
            title = page.get("title", "")
            source = page.get("source", path.stem)
            category = page.get("category", "")
            url = page.get("url", "")
            if not content or len(content) < 50:
                continue
            # Contextual prefix: title provides context for what this chunk is about
            prefix = f"[{title}]" if title else ""
            full_text = f"{prefix}\n{content}" if prefix else content
            for c in splitter.split_text(full_text):
                if c.strip() and len(c.strip()) > 30:
                    chunks.append({
                        "content": c,
                        "source": title or source,
                        "metadata": {"type": "scraped", "file": path.name, "url": url, "category": category},
                    })
        return chunks

    # Handle regular JSON
    config = get_chunk_config(path, "json")
    splitter = make_splitter(config)
    prefix = get_context_prefix(path.stem)
    if isinstance(data, list):
        for item in data:
            # Skip URL-only items
            if isinstance(item, str) and item.startswith("http"):
                continue
            text = item if isinstance(item, str) else "\n".join(f"{k}: {v}" for k, v in item.items() if v) if isinstance(item, dict) else str(item)
            if not text.strip() or len(text.strip()) < 30:
                continue
            for c in splitter.split_text(text):
                if c.strip():
                    content = f"[{prefix}] {c}" if prefix else c
                    chunks.append({"content": content, "source": path.stem, "metadata": {"type": "json", "file": path.name}})
    elif isinstance(data, dict):
        for c in splitter.split_text(json.dumps(data, indent=2)):
            if c.strip():
                content = f"[{prefix}] {c}" if prefix else c
                chunks.append({"content": content, "source": path.stem, "metadata": {"type": "json", "file": path.name}})
    return chunks


def load_csv_file(path: Path) -> list[dict]:
    chunks = []
    config = get_chunk_config(path, "csv")
    splitter = make_splitter(config)
    prefix = get_context_prefix(path.stem)
    with open(path, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    for i in range(0, len(rows), 5):
        block = rows[i:i+5]
        text = "\n".join("; ".join(f"{k}: {v}" for k, v in row.items() if v) for row in block)
        for c in splitter.split_text(text):
            if c.strip():
                content = f"[{prefix}] {c}" if prefix else c
                chunks.append({"content": content, "source": path.stem, "metadata": {"type": "csv", "file": path.name}})
    return chunks


def load_text_file(path: Path) -> list[dict]:
    text = path.read_text(encoding="utf-8")
    chunks = text_splitter.split_text(text)
    return [{"content": c, "source": path.stem, "metadata": {"type": "text", "file": path.name}} for c in chunks if c.strip()]


def load_all_documents() -> list[dict]:
    all_chunks = []
    for path in sorted(DATA_DIR.rglob("*")):
        if path.is_dir():
            continue
        try:
            if path.suffix == ".pdf":
                all_chunks.extend(load_pdf(path))
            elif path.suffix == ".json":
                all_chunks.extend(load_json_file(path))
            elif path.suffix == ".csv":
                all_chunks.extend(load_csv_file(path))
            elif path.suffix == ".txt":
                all_chunks.extend(load_text_file(path))
            else:
                continue
            console.print(f"  [dim]{path.name}[/dim] → {len(all_chunks)} total chunks")
        except Exception as e:
            console.print(f"  [red]Error: {path.name}: {e}[/red]")
    return all_chunks


def upload_chunks(chunks: list[dict]):
    console.print(f"\n[bold]Embedding and uploading {len(chunks)} chunks...[/bold]")
    uploaded = 0

    with Progress(BarColumn(), TextColumn("{task.completed}/{task.total}"), SpinnerColumn()) as progress:
        task = progress.add_task("", total=len(chunks))

        for i in range(0, len(chunks), BATCH_SIZE):
            batch = chunks[i:i+BATCH_SIZE]
            texts = [c["content"] for c in batch]
            embeddings = embed_texts(texts)

            rows = [
                {
                    "content": chunk["content"],
                    "source": chunk["source"],
                    "metadata": chunk["metadata"],
                    "embedding": emb,
                }
                for chunk, emb in zip(batch, embeddings)
            ]

            try:
                supabase.table("chunks").insert(rows).execute()
                uploaded += len(batch)
            except Exception as e:
                console.print(f"  [red]Upload error at batch {i}: {e}[/red]")

            progress.advance(task, len(batch))

    return uploaded


def main():
    console.print("\n[bold blue]═══ InstiGPT Embedding Pipeline ═══[/bold blue]\n")

    # Load
    console.print("[bold]Loading documents...[/bold]")
    chunks = load_all_documents()
    console.print(f"\n[green]Loaded {len(chunks)} chunks from {DATA_DIR}[/green]")

    if not chunks:
        console.print("[red]No documents found in data/[/red]")
        return

    # Upload
    uploaded = upload_chunks(chunks)

    console.print(f"\n[bold green]Done! Uploaded {uploaded} chunks to Supabase.[/bold green]")
    console.print("[dim]Run entity extraction separately later for knowledge graph.[/dim]")


if __name__ == "__main__":
    main()
