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
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="mt-3 flex flex-wrap gap-2"
    >
      {followups.slice(0, 3).map((q) => (
        <button
          key={q}
          onClick={() => onAsk(q)}
          className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground-muted transition-all hover:border-emerald-500/40 hover:bg-emerald-500/5 hover:text-foreground"
        >
          {q}
        </button>
      ))}
    </motion.div>
  );
}
