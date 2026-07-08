"use client";

import { useState, useRef, useEffect } from "react";
import { User, LogOut, Settings, Keyboard } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function ProfileMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (!user) {
    return (
      <a
        href="/login"
        className="flex h-7 items-center rounded border border-border px-2.5 text-2xs text-foreground-muted transition-colors hover:border-border-hover hover:text-foreground"
      >
        Sign in
      </a>
    );
  }

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background-surface text-2xs font-medium text-foreground-muted transition-colors hover:border-border-hover hover:text-foreground"
        aria-label="Profile menu"
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-border bg-background-surface py-1 shadow-lg z-50">
          {/* User info */}
          <div className="border-b border-border px-3 py-2.5">
            <p className="text-xs font-medium text-foreground">{user.name}</p>
            <p className="mt-0.5 text-2xs text-foreground-subtle">{user.email}</p>
          </div>

          {/* Menu items */}
          <div className="py-1">
            <MenuItem icon={User} label="Profile" href="/profile" />
            <MenuItem icon={Keyboard} label="Shortcuts" onClick={() => setOpen(false)} />
            <MenuItem icon={Settings} label="Settings" href="/settings" />
          </div>

          {/* Logout */}
          <div className="border-t border-border py-1">
            <MenuItem
              icon={LogOut}
              label="Sign out"
              onClick={() => { logout(); setOpen(false); }}
              destructive
            />
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  href,
  onClick,
  destructive = false,
}: {
  icon: React.ComponentType<{ size: number }>;
  label: string;
  href?: string;
  onClick?: () => void;
  destructive?: boolean;
}) {
  const cls = `flex w-full items-center gap-2.5 px-3 py-1.5 text-xs transition-colors ${
    destructive
      ? "text-red-400 hover:bg-red-400/5"
      : "text-foreground-muted hover:bg-background-overlay hover:text-foreground"
  }`;

  if (href) {
    return (
      <a href={href} className={cls}>
        <Icon size={13} />
        {label}
      </a>
    );
  }

  return (
    <button onClick={onClick} className={cls}>
      <Icon size={13} />
      {label}
    </button>
  );
}
