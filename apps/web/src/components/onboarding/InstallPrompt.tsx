"use client";

import { useState, useEffect } from "react";
import { X, Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already dismissed
    if (localStorage.getItem("pwa-install-dismissed")) {
      setDismissed(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!deferredPrompt || dismissed) return null;

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setDeferredPrompt(null);
  }

  function handleDismiss() {
    setDismissed(true);
    localStorage.setItem("pwa-install-dismissed", "true");
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm animate-slide-up rounded-lg border border-border bg-background-surface p-3 shadow-lg sm:left-auto sm:right-4">
      <div className="flex items-start gap-3">
        <Download size={16} className="mt-0.5 shrink-0 text-foreground-muted" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-foreground">Install InstiGPT</p>
          <p className="mt-0.5 text-2xs text-foreground-subtle">
            Add to home screen for quick access
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleInstall}
            className="rounded px-2.5 py-1 text-2xs font-medium text-accent hover:bg-accent-muted transition-colors"
          >
            Install
          </button>
          <button
            onClick={handleDismiss}
            className="rounded p-1 text-foreground-subtle hover:text-foreground-muted transition-colors"
            aria-label="Dismiss"
          >
            <X size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
