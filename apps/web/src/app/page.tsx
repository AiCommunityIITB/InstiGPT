"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Menu, Plus, Command } from "lucide-react";
import { Toaster, toast } from "sonner";

import { api } from "@/lib/api";
import { useChat } from "@/hooks/useChat";
import { Sidebar } from "@/components/layout/Sidebar";
import { KeyboardShortcuts } from "@/components/layout/KeyboardShortcuts";
import { ProfileMenu } from "@/components/layout/ProfileMenu";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { InstallPrompt } from "@/components/onboarding/InstallPrompt";
import { IconButton } from "@/components/ui";
import type { Conversation } from "@instigpt/shared";

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<{ focus: () => void }>(null);

  const { messages, isLoading, send, loadMessages, clear } = useChat({
    conversationId: currentConvId,
    onConversationCreated: (id) => {
      setCurrentConvId(id);
      refreshConversations();
    },
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => { refreshConversations(); }, []);

  const refreshConversations = useCallback(async () => {
    try {
      const { conversations: c } = await api.conversations.list();
      setConversations(c);
    } catch {}
  }, []);

  async function selectConversation(id: string) {
    setCurrentConvId(id);
    setSidebarOpen(false);
    try {
      const { messages: m } = await api.conversations.getMessages(id);
      loadMessages(m);
    } catch {
      toast.error("Failed to load conversation");
    }
  }

  function startNew() {
    setCurrentConvId(null);
    clear();
    setSidebarOpen(false);
  }

  function handleSubmit() {
    if (!input.trim()) return;
    send(input);
    setInput("");
  }

  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          style: { background: "#171717", border: "1px solid #222", color: "#ededed", fontSize: "13px" },
        }}
      />

      <KeyboardShortcuts
        onNewChat={startNew}
        onToggleSidebar={() => setSidebarOpen((o) => !o)}
        onFocusInput={() => inputRef.current?.focus()}
      />

      <InstallPrompt />

      <div className="flex h-[100dvh] overflow-hidden">
        <Sidebar
          conversations={conversations}
          currentId={currentConvId}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onSelect={selectConversation}
          onNew={startNew}
        />

        <div className="flex flex-1 flex-col min-w-0">
          {/* Top bar */}
          <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
            <IconButton label="Menu" onClick={() => setSidebarOpen(true)} className="md:hidden">
              <Menu size={16} />
            </IconButton>
            <span className="text-sm font-medium text-foreground">instigpt</span>
            <span className="text-2xs text-foreground-subtle">/</span>
            <span className="text-2xs text-foreground-subtle truncate">
              {currentConvId ? "conversation" : "new"}
            </span>

            <div className="ml-auto flex items-center gap-2">
              {/* Keyboard shortcut hint (desktop only) */}
              <span className="hidden items-center gap-1 rounded border border-border px-1.5 py-0.5 text-2xs text-foreground-subtle md:flex">
                <Command size={9} />K
              </span>
              <IconButton label="New conversation" onClick={startNew}>
                <Plus size={16} />
              </IconButton>
              <ProfileMenu />
            </div>
          </header>

          {/* Messages */}
          <main className="flex-1 overflow-y-auto overscroll-contain">
            {messages.length === 0 ? (
              <EmptyState onExample={(q) => { send(q); }} />
            ) : (
              <div className="mx-auto w-full max-w-2xl space-y-6 px-3 py-6 sm:space-y-8 sm:px-4 sm:py-8 lg:max-w-3xl">
                {messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)}
                <div ref={endRef} className="h-4" />
              </div>
            )}
          </main>

          {/* Input */}
          <div className="shrink-0 border-t border-border px-3 py-3 sm:px-4 sm:py-4">
            <ChatInput
              ref={inputRef}
              value={input}
              onChange={setInput}
              onSubmit={handleSubmit}
              disabled={isLoading}
            />
          </div>
        </div>
      </div>
    </>
  );
}

function EmptyState({ onExample }: { onExample: (q: string) => void }) {
  const examples = [
    "Prerequisites for CS 747",
    "Credits required for honors",
    "Hostel allocation process",
    "Best electives for ML",
    "Branch change requirements",
    "How does SPI/CPI work?",
  ];

  return (
    <div className="flex h-full flex-col items-center justify-center px-4 pb-20">
      <div className="mb-8 text-center sm:mb-10">
        <h1 className="text-lg font-medium text-foreground sm:text-xl">InstiGPT</h1>
        <p className="mt-1 text-xs text-foreground-subtle sm:text-sm">
          Ask anything about IIT Bombay
        </p>
      </div>

      <div className="grid w-full max-w-sm gap-2 sm:max-w-lg sm:grid-cols-2 lg:max-w-xl lg:grid-cols-3 sm:gap-2.5">
        {examples.map((ex) => (
          <button
            key={ex}
            onClick={() => onExample(ex)}
            className="rounded-lg border border-border px-3.5 py-2.5 text-left text-xs text-foreground-muted transition-colors hover:border-border-hover hover:text-foreground sm:px-4 sm:py-3"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
