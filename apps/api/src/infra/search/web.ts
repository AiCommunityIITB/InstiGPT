/**
 * DuckDuckGo web search adapter.
 * Free, no API key, no rate limits for reasonable usage.
 */
import type { WebSearchPort } from "../../domain/chat";
import type { Source } from "@instigpt/shared";

export function createDDGSearch(): WebSearchPort {
  return {
    async search(query: string, maxResults = 3): Promise<Source[]> {
      try {
        const q = encodeURIComponent(`${query} IIT Bombay`);
        const res = await fetch(
          `https://api.duckduckgo.com/?q=${q}&format=json&no_html=1&skip_disambig=1`
        );

        if (!res.ok) return [];

        const data = (await res.json()) as {
          Abstract?: string;
          AbstractSource?: string;
          AbstractURL?: string;
          RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
        };

        const sources: Source[] = [];

        if (data.Abstract) {
          sources.push({
            title: data.AbstractSource || "Web",
            content_snippet: data.Abstract,
            source_type: "web_search",
            metadata: { url: data.AbstractURL },
            relevance_score: 0.5,
          });
        }

        for (const topic of (data.RelatedTopics || []).slice(0, maxResults)) {
          if (topic.Text) {
            sources.push({
              title: "Web",
              content_snippet: topic.Text,
              source_type: "web_search",
              metadata: { url: topic.FirstURL },
              relevance_score: 0.3,
            });
          }
        }

        return sources.slice(0, maxResults);
      } catch {
        return [];
      }
    },
  };
}
