"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";
import { config } from "@/config";

interface Props {
  messageId: string;
  conversationId?: string | null;
}

export function MessageFeedback({ messageId, conversationId }: Props) {
  const [selected, setSelected] = useState<"positive" | "negative" | null>(null);

  async function handleClick(type: "positive" | "negative") {
    if (selected === type) return;
    setSelected(type);

    try {
      const res = await fetch(`${config.apiUrl}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message_id: messageId,
          conversation_id: conversationId,
          type,
        }),
      });
      if (res.ok) {
        toast.success("Thanks for the feedback!");
      }
    } catch {
      // Silently fail — feedback is non-critical
    }
  }

  return (
    <div className="mt-2 flex items-center gap-1">
      <button
        onClick={() => handleClick("positive")}
        className={clsx(
          "rounded p-1 transition-colors",
          selected === "positive"
            ? "text-accent"
            : "text-foreground-subtle hover:text-foreground-muted"
        )}
        aria-label="Good response"
      >
        <ThumbsUp size={12} />
      </button>
      <button
        onClick={() => handleClick("negative")}
        className={clsx(
          "rounded p-1 transition-colors",
          selected === "negative"
            ? "text-red-400"
            : "text-foreground-subtle hover:text-foreground-muted"
        )}
        aria-label="Bad response"
      >
        <ThumbsDown size={12} />
      </button>
      {selected && (
        <span className="ml-1 text-2xs text-foreground-subtle">Thanks</span>
      )}
    </div>
  );
}
