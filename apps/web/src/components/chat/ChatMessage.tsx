"use client";

import { motion } from "motion/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { LoadingDots } from "@/components/ui";
import { SourceCitations } from "@/components/sources/SourceCitations";
import { MessageFeedback } from "@/components/feedback/MessageFeedback";
import type { ChatMessage as MsgType } from "@/hooks/useChat";

export function ChatMessage({ message }: { message: MsgType }) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      {isUser ? <UserBubble content={message.content} /> : <AssistantBlock message={message} />}
    </motion.div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end pl-8 sm:pl-16">
      <div className="chat-user max-w-full sm:max-w-[80%]">
        <p className="whitespace-pre-wrap text-[13px] sm:text-sm">{content}</p>
      </div>
    </div>
  );
}

function AssistantBlock({ message }: { message: MsgType }) {
  const isDone = !message.isStreaming && message.content.length > 0;

  return (
    <div className="flex gap-2.5 pr-8 sm:gap-3 sm:pr-16">
      <div className="mt-[3px] flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border">
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="text-accent">
          <path d="M8 1L14.9 5.5V14.5H1.1V5.5L8 1Z" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>

      <div className="chat-assistant min-w-0 flex-1">
        {message.content ? (
          <>
            <article className="prose prose-sm prose-invert max-w-none prose-p:my-2 prose-p:leading-relaxed prose-headings:text-foreground prose-headings:font-medium prose-pre:rounded-lg prose-pre:border prose-pre:border-border prose-pre:bg-background-surface prose-code:text-accent prose-code:font-mono prose-code:text-xs prose-code:before:content-none prose-code:after:content-none prose-li:my-0.5 prose-ul:my-2 prose-ol:my-2 prose-a:text-accent prose-a:no-underline hover:prose-a:underline prose-blockquote:border-l-border prose-blockquote:text-foreground-muted prose-hr:border-border prose-table:text-xs prose-th:text-foreground-muted prose-td:text-foreground-muted">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {fixMarkdown(message.content)}
              </ReactMarkdown>
            </article>

            {/* Sources */}
            {message.sources && message.sources.length > 0 && (
              <SourceCitations sources={message.sources} />
            )}

            {/* Feedback — only show when done streaming */}
            {isDone && <MessageFeedback messageId={message.id} />}
          </>
        ) : message.isStreaming ? (
          <div className="py-1">
            <LoadingDots />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Fix LLM output that runs sentences together without line breaks.
 * Adds paragraph breaks after sentences that end with period/question mark
 * followed by a capital letter (new sentence).
 */
function fixMarkdown(text: string): string {
  return text
    // Add line break between sentences (period + space + Capital letter)
    .replace(/([.!?])\s*([A-Z])/g, "$1\n\n$2")
    // Ensure a blank line exists before any line starting with "- "
    .replace(/([^\n])\n(- )/g, "$1\n\n$2");
}
