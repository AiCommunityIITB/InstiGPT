"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { IconButton } from "@/components/ui";

export default function SettingsPage() {
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="flex h-12 items-center gap-2 border-b border-border px-3">
        <Link href="/">
          <IconButton label="Back">
            <ArrowLeft size={16} />
          </IconButton>
        </Link>
        <span className="text-sm font-medium text-foreground">Settings</span>
      </header>

      <div className="mx-auto max-w-md px-4 py-8 space-y-8">
        {/* Appearance */}
        <Section title="Appearance">
          <SettingRow
            label="Theme"
            description="Currently dark only"
            action={<span className="text-2xs text-foreground-subtle font-mono">dark</span>}
          />
        </Section>

        {/* Data */}
        <Section title="Data">
          <SettingRow
            label="Export conversations"
            description="Download all your conversations as JSON"
            action={
              <button className="rounded border border-border px-2.5 py-1 text-2xs text-foreground-muted hover:border-border-hover hover:text-foreground transition-colors">
                Export
              </button>
            }
          />
          <SettingRow
            label="Clear all conversations"
            description="This cannot be undone"
            action={
              deleteConfirm ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => setDeleteConfirm(false)}
                    className="rounded px-2.5 py-1 text-2xs text-foreground-subtle hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button className="rounded px-2.5 py-1 text-2xs text-red-400 hover:bg-red-400/10">
                    Confirm
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="rounded border border-border px-2.5 py-1 text-2xs text-red-400 hover:border-red-400/30 transition-colors"
                >
                  Clear
                </button>
              )
            }
          />
        </Section>

        {/* About */}
        <Section title="About">
          <SettingRow
            label="Version"
            description="InstiGPT v2.0.0"
            action={<span className="font-mono text-2xs text-foreground-subtle">2.0.0</span>}
          />
          <SettingRow
            label="Built by"
            description="InstiGPT Team, IIT Bombay"
            action={null}
          />
        </Section>

        {/* Shortcuts reference */}
        <Section title="Keyboard Shortcuts">
          <ShortcutRow keys={["⌘", "K"]} description="Focus input" />
          <ShortcutRow keys={["⌘", "⇧", "N"]} description="New conversation" />
          <ShortcutRow keys={["⌘", "B"]} description="Toggle sidebar" />
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 text-[10px] font-medium uppercase tracking-widest text-foreground-subtle">
        {title}
      </h2>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function SettingRow({
  label,
  description,
  action,
}: {
  label: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-3.5 py-3">
      <div>
        <p className="text-xs text-foreground">{label}</p>
        <p className="mt-0.5 text-2xs text-foreground-subtle">{description}</p>
      </div>
      {action}
    </div>
  );
}

function ShortcutRow({ keys, description }: { keys: string[]; description: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-3.5 py-2.5">
      <span className="text-xs text-foreground-muted">{description}</span>
      <div className="flex items-center gap-1">
        {keys.map((key, i) => (
          <kbd
            key={i}
            className="flex h-5 min-w-[20px] items-center justify-center rounded border border-border bg-background-overlay px-1 text-2xs text-foreground-subtle"
          >
            {key}
          </kbd>
        ))}
      </div>
    </div>
  );
}
