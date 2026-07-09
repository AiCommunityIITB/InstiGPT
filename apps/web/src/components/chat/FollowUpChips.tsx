"use client";

import { motion } from "motion/react";

interface Props {
  followups: string[];
  onAsk: (question: string) => void;
}

export function FollowUpChips({ followups, onAsk }: Props) {
  if (!followups.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut", delay: 0.1 }}
      className="mt-4 space-y-1.5"
    >
      {followups.slice(0, 3).map((q) => (
        <button
          key={q}
          onClick={() => onAsk(q)}
          className="block w-full rounded-lg border border-border px-3 py-2 text-left text-xs text-foreground-muted transition-all hover:border-emerald-500/40 hover:bg-emerald-500/5 hover:text-foreground"
        >
          {q}
        </button>
      ))}
    </motion.div>
  );
}
