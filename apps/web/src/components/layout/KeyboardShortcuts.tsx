"use client";

import { useEffect, useCallback } from "react";

interface Props {
  onNewChat: () => void;
  onToggleSidebar: () => void;
  onFocusInput: () => void;
}

/**
 * Keyboard shortcuts handler.
 * Cmd+K → focus input
 * Cmd+Shift+N → new chat
 * Cmd+B → toggle sidebar
 */
export function KeyboardShortcuts({ onNewChat, onToggleSidebar, onFocusInput }: Props) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const meta = e.metaKey || e.ctrlKey;

    if (meta && e.key === "k") {
      e.preventDefault();
      onFocusInput();
    } else if (meta && e.shiftKey && e.key === "N") {
      e.preventDefault();
      onNewChat();
    } else if (meta && e.key === "b") {
      e.preventDefault();
      onToggleSidebar();
    }
  }, [onNewChat, onToggleSidebar, onFocusInput]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return null;
}
