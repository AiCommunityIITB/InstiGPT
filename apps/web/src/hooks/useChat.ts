"use client";

/**
 * useChat hook - the core of the chat experience.
 *
 * Handles sending messages, streaming the response token by token,
 * parsing SSE events (sources, follow-ups, title, errors), and
 * managing the message array that the UI renders.
 *
 * This hook never touches the DOM. It just manages state and the
 * streaming connection. The UI components read from it.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import { parseSSEStream } from "@/lib/sse";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  sources?: Array<{
    title: string;
    source_type: "document" | "graph" | "web_search";
    relevance_score: number;
  }>;
  followups?: string[];
}

interface UseChatOptions {
  conversationId?: string | null;
  onConversationCreated?: (id: string) => void;
  onTitleGenerated?: (title: string) => void;
}

export function useChat(options: UseChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{ code?: string; message: string } | null>(null);

  // Use ref so send() always reads the latest conversationId
  const convIdRef = useRef(options.conversationId);
  useEffect(() => {
    convIdRef.current = options.conversationId;
  }, [options.conversationId]);

  const onCreatedRef = useRef(options.onConversationCreated);
  useEffect(() => {
    onCreatedRef.current = options.onConversationCreated;
  }, [options.onConversationCreated]);

  const onTitleRef = useRef(options.onTitleGenerated);
  useEffect(() => {
    onTitleRef.current = options.onTitleGenerated;
  }, [options.onTitleGenerated]);

  const send = useCallback(async (question: string) => {
    if (!question.trim() || isLoading) return;

    setError(null);

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(), role: "user", content: question.trim(),
    };
    const aId = crypto.randomUUID();
    const assistantMsg: ChatMessage = {
      id: aId, role: "assistant", content: "", isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsLoading(true);

    try {
      const res = await api.chat.stream(
        question.trim(), convIdRef.current || undefined
      );

      if (res.status === 429) {
        setError({ message: "Slow down! Try again in a few seconds." });
        setMessages((p) =>
          p.map((m) => m.id === aId
            ? { ...m, content: "Slow down! Try again in a few seconds.", isStreaming: false }
            : m)
        );
        setIsLoading(false);
        return;
      }

      if (res.status === 401) {
        const body = await res.json().catch(() => ({}));
        if ((body as { code?: string }).code === "ANON_LIMIT") {
          setError({ code: "ANON_LIMIT", message: "Sign up to continue chatting" });
          setMessages((p) =>
            p.map((m) => m.id === aId
              ? { ...m, content: "Sign up to continue chatting.", isStreaming: false }
              : m)
          );
          setIsLoading(false);
          return;
        }
      }

      if (!res.ok) throw new Error("Failed");

      for await (const ev of parseSSEStream(res)) {
        switch (ev.event) {
          case "token":
            setMessages((p) =>
              p.map((m) => m.id === aId ? { ...m, content: m.content + ev.data } : m)
            );
            break;
          case "sources": {
            const sources = JSON.parse(ev.data);
            setMessages((p) =>
              p.map((m) => m.id === aId ? { ...m, sources } : m)
            );
            break;
          }
          case "followups": {
            const followups = JSON.parse(ev.data) as string[];
            setMessages((p) =>
              p.map((m) => m.id === aId ? { ...m, followups } : m)
            );
            break;
          }
          case "title": {
            onTitleRef.current?.(ev.data);
            break;
          }
          case "metadata": {
            const meta = JSON.parse(ev.data);
            if (meta.conversation_id) {
              convIdRef.current = meta.conversation_id;
              onCreatedRef.current?.(meta.conversation_id);
            }
            break;
          }
          case "done":
            setMessages((p) =>
              p.map((m) => m.id === aId ? { ...m, isStreaming: false } : m)
            );
            break;
          case "error":
            setMessages((p) =>
              p.map((m) => m.id === aId
                ? { ...m, content: "Something went wrong. Try again.", isStreaming: false }
                : m)
            );
            break;
        }
      }
    } catch {
      setMessages((p) =>
        p.map((m) => m.id === aId
          ? { ...m, content: "Couldn't connect. Please try again.", isStreaming: false }
          : m)
      );
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const loadMessages = useCallback(
    (msgs: Array<{ id: string; role: string; content: string; sources?: any }>) => {
      setMessages(msgs.map((m) => ({
        id: m.id, role: m.role as "user" | "assistant", content: m.content, sources: m.sources,
      })));
    }, []
  );

  const clear = useCallback(() => {
    setMessages([]);
    setError(null);
    convIdRef.current = null;
  }, []);

  return { messages, isLoading, send, loadMessages, clear, error };
}
