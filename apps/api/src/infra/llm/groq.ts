/**
 * Groq LLM adapter — implements the LLMPort interface.
 * Isolated from business logic. Easy to swap for OpenAI, Anthropic, etc.
 */
import Groq from "groq-sdk";
import type { LLMPort } from "../../domain/chat";

export function createGroqLLM(apiKey: string): LLMPort {
  const client = new Groq({ apiKey });

  return {
    async *streamCompletion({ systemPrompt, messages }) {
      const stream = await client.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        max_tokens: 2048,
        temperature: 0.7,
        stream: true,
      });

      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content;
        if (token) yield token;
      }
    },

    async complete(prompt) {
      const res = await client.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
        temperature: 0,
      });

      return res.choices[0]?.message?.content?.trim() || "";
    },
  };
}
