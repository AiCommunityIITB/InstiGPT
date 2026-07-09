"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";
import { config } from "@/config";

type FeedbackReason =
  | "wrong_info"
  | "irrelevant"
  | "incomplete"
  | "hallucination"
  | "outdated";

const REASON_LABELS: Record<FeedbackReason, string> = {
  wrong_info: "Wrong info",
  irrelevant: "Irrelevant",
  incomplete: "Incomplete",
  hallucination: "Made up",
  outdated: "Outdated",
};

interface Props {
  messageId: string;
  conversationId?: string | null;
}

export function MessageFeedback({ messageId, conversationId }: Props) {
  const [selected, setSelected] = useState<"positive" | "negative" | null>(null);
  const [showReasons, setShowReasons] = useState(false);
  const [selectedReason, setSelectedReason] = useState<FeedbackReason | null>(null);

  async function submitFeedback(type: "positive" | "negative", reason?: FeedbackReason) {
    try {
      const res = await fetch(`${config.apiUrl}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message_id: messageId,
          conversation_id: conversationId,
          type,
          reason,
        }),
      });
      if (res.ok) {
        toast.success("Thanks for the feedback!");
      }
    } catch {
      // Silently fail — feedback is non-critical
    }
  }

  function handleThumbsUp() {
    if (selected === "positive") return;
    setSelected("positive");
    setShowReasons(false);
    submitFeedback("positive");
  }

  function handleThumbsDown() {
    if (selected === "negative") return;
    setSelected("negative");
    setShowReasons(true);
  }

  function handleReasonClick(reason: FeedbackReason) {
    setSelectedReason(reason);
    setShowReasons(false);
    submitFeedback("negative", reason);
  }

  function handleSkipReason() {
    setShowReasons(false);
    submitFeedback("negative");
  }

  return (
    <div className="mt-2">
      <div className="flex items-center gap-1">
        <button
          onClick={handleThumbsUp}
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
          onClick={handleThumbsDown}
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
        {selected && !showReasons && (
          <span className="ml-1 text-2xs text-foreground-subtle">
            {selectedReason ? REASON_LABELS[selectedReason] : "Thanks"}
          </span>
        )}
      </div>

      {showReasons && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {(Object.entries(REASON_LABELS) as [FeedbackReason, string][]).map(
            ([reason, label]) => (
              <button
                key={reason}
                onClick={() => handleReasonClick(reason)}
                className="rounded-full border border-border-subtle px-2 py-0.5 text-2xs text-foreground-muted transition-colors hover:border-accent hover:text-accent"
              >
                {label}
              </button>
            )
          )}
          <button
            onClick={handleSkipReason}
            className="rounded-full px-2 py-0.5 text-2xs text-foreground-subtle hover:text-foreground-muted"
          >
            Skip
          </button>
        </div>
      )}
    </div>
  );
}
