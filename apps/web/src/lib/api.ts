import { config } from "@/config";
import type { User, Conversation, Message } from "@instigpt/shared";

const BASE = config.apiUrl;
const json = { "Content-Type": "application/json" };
const creds: RequestInit = { credentials: "include" };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { ...creds, ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `${res.status}`);
  }
  return res.json();
}

export const api = {
  auth: {
    login: (code: string) => request<{ user: User }>(`/auth/login?code=${code}`),
    logout: () => request<{ success: boolean }>("/auth/logout"),
    me: () => request<{ user: User }>("/auth/me"),
  },
  conversations: {
    list: () => request<{ conversations: Conversation[] }>("/conversations"),
    create: (title: string) =>
      request<{ conversation: Conversation }>("/conversations", {
        method: "POST", headers: json, body: JSON.stringify({ title }),
      }),
    getMessages: (id: string) =>
      request<{ messages: Message[] }>(`/conversations/${id}/messages`),
    rename: (id: string, title: string) =>
      request<{ conversation: Conversation }>(`/conversations/${id}`, {
        method: "PATCH", headers: json, body: JSON.stringify({ title }),
      }),
    remove: (id: string) =>
      request<{ success: boolean }>(`/conversations/${id}`, { method: "DELETE" }),
  },
  chat: {
    stream: (question: string, conversationId?: string): Promise<Response> =>
      fetch(`${BASE}/chat`, {
        method: "POST", headers: json, credentials: "include",
        body: JSON.stringify({ question, conversation_id: conversationId }),
      }),
  },
};
