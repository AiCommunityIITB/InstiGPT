"use client";

import { MessageSquare, Plus, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { IconButton } from "@/components/ui";
import type { Conversation } from "@instigpt/shared";

interface Props {
  conversations: Conversation[];
  currentId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export function Sidebar({ conversations, currentId, isOpen, onClose, onSelect, onNew }: Props) {
  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Sidebar panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-background transition-transform duration-200 ease-out md:relative md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
          <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-subtle">
            History
          </span>
          <div className="flex items-center gap-0.5">
            <IconButton label="New conversation" onClick={onNew}>
              <Plus size={14} />
            </IconButton>
            <IconButton label="Close" onClick={onClose} className="md:hidden">
              <X size={14} />
            </IconButton>
          </div>
        </div>

        {/* Conversation list */}
        <nav className="flex-1 overflow-y-auto overscroll-contain px-1.5 py-1.5">
          {conversations.length === 0 ? (
            <p className="px-2 py-8 text-center text-xs text-foreground-subtle">
              No conversations
            </p>
          ) : (
            <ul className="space-y-px">
              {conversations.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => onSelect(c.id)}
                    className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12px] transition-colors ${
                      currentId === c.id
                        ? "bg-background-overlay text-foreground"
                        : "text-foreground-muted hover:bg-background-surface hover:text-foreground"
                    }`}
                  >
                    <MessageSquare size={11} className="shrink-0 opacity-40" />
                    <span className="truncate">{c.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t border-border px-3 py-2.5 space-y-1">
          <a href="/profile" className="flex items-center gap-2 rounded px-2 py-1.5 text-[11px] text-foreground-muted hover:bg-background-surface hover:text-foreground transition-colors">
            Profile
          </a>
          <a href="/settings" className="flex items-center gap-2 rounded px-2 py-1.5 text-[11px] text-foreground-muted hover:bg-background-surface hover:text-foreground transition-colors">
            Settings
          </a>
          <p className="px-2 pt-1 text-[10px] text-foreground-subtle font-mono">v2.0.0</p>
        </div>
      </aside>
    </>
  );
}
