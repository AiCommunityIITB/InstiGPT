"use client";

import { useState } from "react";
import { ChevronDown, FileText, Globe, GitBranch } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import clsx from "clsx";

interface Source {
  title: string;
  source_type: "document" | "graph" | "web_search";
  relevance_score: number;
}

interface Props {
  sources: Source[];
}

const typeIcons = {
  document: FileText,
  graph: GitBranch,
  web_search: Globe,
};

const typeLabels = {
  document: "Document",
  graph: "Knowledge Graph",
  web_search: "Web",
};

export function SourceCitations({ sources }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!sources.length) return null;

  return (
    <div className="mt-3 border-t border-border pt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-2xs text-foreground-subtle hover:text-foreground-muted transition-colors"
      >
        <span>{sources.length} source{sources.length > 1 ? "s" : ""}</span>
        <ChevronDown
          size={10}
          className={clsx("transition-transform", expanded && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <ul className="mt-2 space-y-1">
              {sources.map((source, i) => {
                const Icon = typeIcons[source.source_type];
                return (
                  <li
                    key={i}
                    className="flex items-center gap-2 rounded px-2 py-1.5 text-2xs text-foreground-muted"
                  >
                    <Icon size={10} className="shrink-0 opacity-50" />
                    <span className="truncate">{source.title}</span>
                    <span className="ml-auto shrink-0 font-mono text-foreground-subtle">
                      {typeLabels[source.source_type]}
                    </span>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
