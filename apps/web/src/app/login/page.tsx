"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const router = useRouter();
  const { login, signup } = useAuth();
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const err = isSignup
      ? await signup(email, password, name)
      : await login(email, password);

    setLoading(false);
    if (err) {
      setError(err);
    } else {
      router.replace("/");
    }
  }

  return (
    <div className="flex h-[100dvh] flex-col items-center justify-center px-4">
      <div className="w-full max-w-xs">
        <h1 className="text-lg font-medium text-foreground text-center">InstiGPT</h1>
        <p className="mt-1 text-xs text-foreground-subtle text-center">
          {isSignup ? "Create an account" : "Sign in to continue"}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-3">
          {isSignup && (
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background-surface px-3.5 py-2.5 text-sm text-foreground outline-none placeholder:text-foreground-subtle focus:border-border-hover"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-border bg-background-surface px-3.5 py-2.5 text-sm text-foreground outline-none placeholder:text-foreground-subtle focus:border-border-hover"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full rounded-lg border border-border bg-background-surface px-3.5 py-2.5 text-sm text-foreground outline-none placeholder:text-foreground-subtle focus:border-border-hover"
          />

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-foreground py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "..." : isSignup ? "Create account" : "Sign in"}
          </button>
        </form>

        <button
          onClick={() => { setIsSignup(!isSignup); setError(null); }}
          className="mt-4 w-full text-center text-xs text-foreground-subtle hover:text-foreground-muted"
        >
          {isSignup ? "Already have an account? Sign in" : "No account? Create one"}
        </button>
      </div>
    </div>
  );
}
