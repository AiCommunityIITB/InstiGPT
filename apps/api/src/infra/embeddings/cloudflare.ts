/**
 * Embedding adapters.
 *
 * Production: Cloudflare Workers AI (free, at edge)
 * Local dev: calls a local Python embedding server running the same BGE model
 */
import type { EmbeddingPort } from "../../domain/chat";

const LOCAL_EMBED_URL = "http://localhost:9999";

/**
 * Cloudflare Workers AI embedding (production)
 */
export function createCFEmbedding(ai: Ai): EmbeddingPort {
  return {
    async embed(text: string): Promise<number[]> {
      const res = (await ai.run("@cf/baai/bge-base-en-v1.5", {
        text: [text],
      })) as { data: number[][] };
      return res.data[0];
    },
  };
}

/**
 * Local embedding server (development)
 * Calls the Python BGE server running on port 9999
 */
export function createLocalEmbedding(): EmbeddingPort {
  return {
    async embed(text: string): Promise<number[]> {
      try {
        const res = await fetch(LOCAL_EMBED_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });

        if (!res.ok) {
          console.error("Embedding server error:", res.status);
          return dummyEmbedding(text);
        }

        const data = (await res.json()) as { embedding: number[] };
        return data.embedding;
      } catch {
        console.error("Embedding server not running. Start it: python scripts/embed_server.py");
        return dummyEmbedding(text);
      }
    },
  };
}

/** Last resort fallback — hash-based dummy vector */
function dummyEmbedding(text: string): number[] {
  const embedding: number[] = [];
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  for (let i = 0; i < 768; i++) {
    hash = ((hash << 5) - hash + i) | 0;
    embedding.push(((hash & 0xff) / 255) * 2 - 1);
  }
  const norm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
  return embedding.map((v) => v / norm);
}
