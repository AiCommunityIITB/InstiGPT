"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { IconButton } from "@/components/ui";

export default function ProfilePage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <p className="text-xs text-foreground-subtle">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <p className="text-xs text-foreground-subtle">Not signed in</p>
      </div>
    );
  }

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="flex h-12 items-center gap-2 border-b border-border px-3">
        <Link href="/">
          <IconButton label="Back">
            <ArrowLeft size={16} />
          </IconButton>
        </Link>
        <span className="text-sm font-medium text-foreground">Profile</span>
      </header>

      <div className="mx-auto max-w-md px-4 py-8">
        <div className="flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-background-surface text-lg font-medium text-foreground">
            {initials}
          </div>
          <h1 className="mt-3 text-base font-medium text-foreground">{user.name}</h1>
          <p className="text-xs text-foreground-subtle">{user.email}</p>
        </div>

        <div className="mt-8 space-y-1">
          <DetailRow label="Email" value={user.email} />
          <DetailRow label="Name" value={user.name} />
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-3.5 py-2.5">
      <span className="text-xs text-foreground-subtle">{label}</span>
      <span className="text-xs text-foreground font-mono">{value}</span>
    </div>
  );
}
