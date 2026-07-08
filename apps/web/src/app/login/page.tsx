"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { config } from "@/config";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const code = params.get("code");

  useEffect(() => {
    if (code) {
      api.auth.login(code).then(() => router.replace("/")).catch(() => {});
    }
  }, [code, router]);

  if (code) {
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <p className="text-sm text-foreground-subtle">Authenticating...</p>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col items-center justify-center px-4">
      <div className="w-full max-w-xs text-center">
        <h1 className="text-lg font-medium text-foreground">InstiGPT</h1>
        <p className="mt-1 text-xs text-foreground-subtle">
          Sign in with your IIT Bombay account
        </p>

        <a
          href={config.ssoUrl}
          className="mt-8 inline-flex h-10 w-full items-center justify-center rounded-lg border border-border bg-background-surface text-sm text-foreground transition-colors hover:border-border-hover hover:bg-background-overlay"
        >
          Continue with SSO
        </a>

        <p className="mt-6 text-2xs text-foreground-subtle leading-relaxed">
          By signing in, you agree that this is a student-built tool
          and responses should be verified with official sources.
        </p>
      </div>
    </div>
  );
}
