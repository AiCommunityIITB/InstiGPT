"""
InstiGPT Web Scraper — Scrapes actual page content from IIT Bombay websites.

Usage:
    python scrape.py              # Scrape all URLs from data/urls/
    python scrape.py --source asc # Scrape ASC portal specifically
    python scrape.py --limit 50   # Limit to 50 pages for testing

Output: data/scraped/ directory with JSON files containing page text.
"""

import asyncio
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse
from dataclasses import dataclass, asdict

import httpx
from bs4 import BeautifulSoup
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn

console = Console()

# ═══ Config ═══

DATA_DIR = Path(__file__).parent.parent / "data"
OUTPUT_DIR = DATA_DIR / "scraped"
URLS_DIR = DATA_DIR / "urls"
CONCURRENCY = 5  # parallel requests
TIMEOUT = 15     # seconds per request
MAX_CONTENT_LENGTH = 50000  # chars per page (skip huge pages)

# URLs to skip (images, PDFs, etc.)
SKIP_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif', '.svg', '.pdf', '.doc',
                   '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.tar',
                   '.gz', '.mp4', '.mp3', '.wav', '.avi'}

# High-value IITB sources to scrape directly (not in existing URL lists)
PRIORITY_URLS = [
    # Academic Office / ASC
    "https://www.iitb.ac.in/newacadhome/ugrules.jsp",
    "https://www.iitb.ac.in/newacadhome/pgrules.jsp",
    "https://www.iitb.ac.in/newacadhome/branchChange.jsp",
    "https://www.iitb.ac.in/newacadhome/minor.jsp",
    "https://www.iitb.ac.in/newacadhome/honor.jsp",
    "https://www.iitb.ac.in/newacadhome/grading.jsp",
    "https://www.iitb.ac.in/newacadhome/BTechrulesbook.jsp",
    # Student Affairs
    "https://gymkhana.iitb.ac.in/~ssc/about",
    "https://gymkhana.iitb.ac.in/~cultural/",
    "https://gymkhana.iitb.ac.in/~sports/",
    # Placement
    "https://www.placements.iitb.ac.in/",
    # General
    "https://www.iitb.ac.in/en/about-iit-bombay",
    "https://www.iitb.ac.in/en/education/academic-programmes",
    "https://www.iitb.ac.in/en/education/departments",
    # Hostel
    "https://www.iitb.ac.in/en/hostels",
    # International Relations
    "https://www.iitb.ac.in/en/international-relations",
    # Library
    "https://www.library.iitb.ac.in/",
]


@dataclass
class ScrapedPage:
    url: str
    title: str
    content: str
    source: str       # e.g., "dept/cse", "itc/wncc", "asc"
    category: str     # e.g., "department", "club", "academic", "hostel"
    word_count: int


# ═══ URL Loading ═══

def load_urls_from_data() -> list[tuple[str, str, str]]:
    """Load all URLs from data/urls/ directory. Returns (url, source, category)."""
    urls = []

    for json_file in URLS_DIR.rglob("*.json"):
        rel_path = json_file.relative_to(URLS_DIR)
        source = str(rel_path.with_suffix(""))
        
        # Determine category from path
        parts = rel_path.parts
        if "dept" in parts:
            category = "department"
        elif "itc" in parts:
            category = "club"
        elif "damp" in parts:
            category = "academics"
        elif "misc" in parts:
            category = "misc"
        else:
            category = "general"

        try:
            data = json.loads(json_file.read_text())
            if isinstance(data, list):
                for url in data:
                    if isinstance(url, str) and url.startswith("http"):
                        urls.append((url, source, category))
            elif isinstance(data, dict):
                # Handle dict format (some files might have {url: content})
                for url in data.keys():
                    if url.startswith("http"):
                        urls.append((url, source, category))
        except (json.JSONDecodeError, Exception) as e:
            console.print(f"[yellow]Skipping {json_file}: {e}[/]")

    return urls


def should_skip_url(url: str) -> bool:
    """Skip non-HTML resources."""
    parsed = urlparse(url)
    path = parsed.path.lower()
    ext = Path(path).suffix
    return ext in SKIP_EXTENSIONS


# ═══ Content Extraction ═══

def extract_content(html: str, url: str) -> tuple[str, str]:
    """Extract meaningful text content from HTML. Returns (title, content)."""
    soup = BeautifulSoup(html, "html.parser")

    # Remove noise
    for tag in soup(["script", "style", "nav", "footer", "header",
                     "aside", "form", "iframe", "noscript"]):
        tag.decompose()

    # Get title
    title = ""
    if soup.title:
        title = soup.title.get_text(strip=True)
    elif soup.find("h1"):
        title = soup.find("h1").get_text(strip=True)

    # Get main content (prefer main/article tags)
    main = soup.find("main") or soup.find("article") or soup.find(
        "div", {"class": re.compile(r"content|main|body", re.I)}
    )

    if main:
        text = main.get_text(separator="\n", strip=True)
    else:
        text = soup.get_text(separator="\n", strip=True)

    # Clean up
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    # Remove very short lines (likely nav items)
    lines = [l for l in lines if len(l) > 20 or any(c.isalpha() for c in l)]
    content = "\n".join(lines)

    # Skip if too little content
    if len(content) < 100:
        return title, ""

    # Truncate very long pages
    if len(content) > MAX_CONTENT_LENGTH:
        content = content[:MAX_CONTENT_LENGTH]

    return title, content


# ═══ Async Scraping ═══

async def scrape_url(
    client: httpx.AsyncClient,
    url: str,
    source: str,
    category: str
) -> ScrapedPage | None:
    """Scrape a single URL."""
    if should_skip_url(url):
        return None

    try:
        resp = await client.get(url, follow_redirects=True, timeout=TIMEOUT)
        if resp.status_code != 200:
            return None
        
        content_type = resp.headers.get("content-type", "")
        if "text/html" not in content_type:
            return None

        title, content = extract_content(resp.text, url)
        if not content:
            return None

        return ScrapedPage(
            url=url,
            title=title,
            content=content,
            source=source,
            category=category,
            word_count=len(content.split()),
        )
    except (httpx.TimeoutException, httpx.ConnectError, Exception):
        return None


async def scrape_batch(
    urls: list[tuple[str, str, str]],
    limit: int | None = None
) -> list[ScrapedPage]:
    """Scrape URLs in parallel batches."""
    if limit:
        urls = urls[:limit]

    results: list[ScrapedPage] = []
    semaphore = asyncio.Semaphore(CONCURRENCY)

    async with httpx.AsyncClient(
        headers={"User-Agent": "InstiGPT-Scraper/1.0 (IIT Bombay student project)"},
        verify=False,  # Some IITB sites have cert issues
    ) as client:
        async def bounded_scrape(url, source, category):
            async with semaphore:
                return await scrape_url(client, url, source, category)

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            TextColumn("({task.completed}/{task.total})"),
            console=console,
        ) as progress:
            task = progress.add_task("Scraping...", total=len(urls))

            # Process in batches
            batch_size = 20
            for i in range(0, len(urls), batch_size):
                batch = urls[i:i + batch_size]
                tasks = [bounded_scrape(url, src, cat) for url, src, cat in batch]
                batch_results = await asyncio.gather(*tasks)

                for result in batch_results:
                    if result:
                        results.append(result)
                    progress.advance(task)

    return results


# ═══ Main ═══

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Scrape IITB websites for InstiGPT")
    parser.add_argument("--limit", type=int, help="Max URLs to scrape")
    parser.add_argument("--source", type=str, help="Only scrape specific source (e.g., 'dept', 'itc')")
    parser.add_argument("--priority-only", action="store_true", help="Only scrape priority URLs")
    args = parser.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Gather URLs
    if args.priority_only:
        urls = [(url, "priority", "academic") for url in PRIORITY_URLS]
    else:
        urls = load_urls_from_data()
        # Add priority URLs
        urls.extend([(url, "priority", "academic") for url in PRIORITY_URLS])

    if args.source:
        urls = [(u, s, c) for u, s, c in urls if args.source in s]

    # Deduplicate
    seen = set()
    unique_urls = []
    for url, source, cat in urls:
        if url not in seen:
            seen.add(url)
            unique_urls.append((url, source, cat))
    urls = unique_urls

    console.print(f"\n[bold]InstiGPT Web Scraper[/]")
    console.print(f"URLs to scrape: [cyan]{len(urls)}[/]")
    console.print(f"Output: [cyan]{OUTPUT_DIR}[/]\n")

    # Scrape
    results = asyncio.run(scrape_batch(urls, limit=args.limit))

    # Save results grouped by source
    grouped: dict[str, list[dict]] = {}
    for page in results:
        key = page.source.replace("/", "_")
        if key not in grouped:
            grouped[key] = []
        grouped[key].append(asdict(page))

    total_words = 0
    for key, pages in grouped.items():
        output_file = OUTPUT_DIR / f"{key}.json"
        output_file.write_text(json.dumps(pages, indent=2, ensure_ascii=False))
        words = sum(p["word_count"] for p in pages)
        total_words += words
        console.print(f"  [green]✓[/] {key}: {len(pages)} pages, {words:,} words")

    console.print(f"\n[bold green]Done![/]")
    console.print(f"  Total pages scraped: [cyan]{len(results)}[/]")
    console.print(f"  Total words: [cyan]{total_words:,}[/]")
    console.print(f"  Output directory: [cyan]{OUTPUT_DIR}[/]")
    console.print(f"\n[dim]Next: run 'python embed.py' to embed the scraped content[/]")


if __name__ == "__main__":
    main()
