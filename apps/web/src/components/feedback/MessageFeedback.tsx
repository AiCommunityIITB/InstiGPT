"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import clsx from "clsx";

interface Props {
  messageId: string;
  onFeedback?: (messageId: string, type: "positive" | "negative") => void;
}

export function MessageFeedback({ messageId, onFeedback }: Props) {
  const [selected, setSelected] = useState<"positive" | "negative" | null>(null);

  function handleClick(type: "positive" | "negative") {
    if (selected === type) return;
    setSelected(type);
    onFeedback?.(messageId, type);
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
