"use client";

import { useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import { ArrowUp } from "lucide-react";
import clsx from "clsx";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export interface ChatInputHandle {
  focus: () => void;
}

export const ChatInput = forwardRef<ChatInputHandle, Props>(
  ({ value, onChange, onSubmit, disabled }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
    }));

    useEffect(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
      }
    }, [value]);

    // Auto-focus on desktop
    useEffect(() => {
      if (window.innerWidth > 768) textareaRef.current?.focus();
    }, []);

    const canSend = value.trim().length > 0 && !disabled;

    return (
      <div className="mx-auto w-full max-w-2xl px-2 sm:px-0 lg:max-w-3xl">
        <div className="relative rounded-xl border border-border bg-background-surface transition-colors focus-within:border-border-hover">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (canSend) onSubmit();
              }
            }}
            placeholder="Ask a question..."
            className="block w-full resize-none bg-transparent px-3.5 py-3 pr-12 text-[13px] text-foreground outline-none placeholder:text-foreground-subtle sm:px-4 sm:text-sm"
            rows={1}
            disabled={disabled}
          />
          <button
            type="button"
            onClick={() => { if (canSend) onSubmit(); }}
            disabled={!canSend}
            className={clsx(
              "absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-lg transition-all",
              canSend
                ? "bg-foreground text-background"
                : "bg-background-overlay text-foreground-subtle opacity-40"
            )}
            aria-label="Send"
          >
            <ArrowUp size={14} strokeWidth={2.5} />
          </button>
        </div>
        <p className="mt-2 text-center text-2xs text-foreground-subtle hidden sm:block">
          InstiGPT may produce inaccurate information. Verify with official sources.
        </p>
      </div>
    );
  }
);

ChatInput.displayName = "ChatInput";
