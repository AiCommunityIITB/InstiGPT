"use client";

import Link from "next/link";

export function SignupPrompt() {
  return (
    <div className="rounded-lg border border-border bg-background-surface p-3 text-xs text-foreground-muted">
      You&apos;ve used 5 free messages.{" "}
      <Link href="/login" className="text-accent hover:underline">
        Sign up
      </Link>{" "}
      to continue and save history.
    </div>
  );
}
