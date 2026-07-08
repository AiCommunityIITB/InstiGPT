"use client";

import { forwardRef } from "react";

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, className = "", children, ...props }, ref) => (
    <button
      ref={ref}
      aria-label={label}
      className={`rounded p-1.5 text-foreground-subtle transition-colors hover:text-foreground hover:bg-background-overlay ${className}`}
      {...props}
    >
      {children}
    </button>
  )
);
IconButton.displayName = "IconButton";

export function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-[3px]">
      <span className="h-[3px] w-[3px] rounded-full bg-foreground-subtle animate-pulse-slow" />
      <span className="h-[3px] w-[3px] rounded-full bg-foreground-subtle animate-pulse-slow [animation-delay:300ms]" />
      <span className="h-[3px] w-[3px] rounded-full bg-foreground-subtle animate-pulse-slow [animation-delay:600ms]" />
    </span>
  );
}
