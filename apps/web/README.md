# InstiGPT Web

The frontend for InstiGPT. Built with Next.js 15 and React 19.

**Live:** https://insti-gpt-web.vercel.app

## Stack

| | |
|---|---|
| Framework | Next.js 15 (App Router) |
| UI | React 19, Tailwind CSS 3 |
| Animations | Framer Motion (via `motion/react`) |
| Icons | Lucide React |
| Toasts | Sonner |
| Markdown | react-markdown + remark-gfm |

Everything is client-side rendered. There are no Next.js server components, server actions, or API routes.

## Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout: fonts, AuthProvider, ErrorBoundary
│   ├── page.tsx            # Main chat page
│   ├── globals.css         # Tailwind base + scrollbar + iOS safe areas
│   ├── login/page.tsx      # Email/password login + signup
│   ├── profile/page.tsx    # Basic user info
│   └── settings/page.tsx   # Theme, data export, keyboard shortcuts
├── components/
│   ├── chat/
│   │   ├── ChatMessage.tsx    # User bubble or assistant markdown block
│   │   ├── ChatInput.tsx      # Auto-resize textarea + send button
│   │   ├── FollowUpChips.tsx  # Suggested follow-up question buttons
│   │   └── SignupPrompt.tsx   # Banner shown to anonymous users after 5 messages
│   ├── layout/
│   │   ├── Sidebar.tsx           # Conversation history panel
│   │   ├── ProfileMenu.tsx       # Avatar dropdown
│   │   └── KeyboardShortcuts.tsx # Global keyboard listener
│   ├── sources/
│   │   └── SourceCitations.tsx  # Expandable source list per message
│   ├── feedback/
│   │   └── MessageFeedback.tsx  # Thumbs up/down, POSTs to API
│   ├── onboarding/
│   │   └── InstallPrompt.tsx    # PWA install banner
│   ├── ErrorBoundary.tsx   # Catches render crashes, shows recovery screen
│   └── ui/index.tsx        # Primitives: IconButton, LoadingDots
├── hooks/
│   ├── useChat.ts          # Manages messages, handles SSE stream
│   └── useAuth.tsx         # Auth context: login, signup, logout, session
├── lib/
│   ├── api.ts              # Typed API client for all endpoints
│   └── sse.ts              # Async generator that parses SSE stream
└── config/index.ts         # API URL from env, dev detection
```

## Design System

Dark theme with a Supabase-inspired color palette. All tokens are in `tailwind.config.ts`.

```
Background:  #090909 (base) -> #111111 (surface) -> #171717 (overlay)
Foreground:  #ededed (text) -> #888888 (muted) -> #666666 (subtle)
Border:      #222222 -> #333333 (hover)
Accent:      #3ecf8e (emerald green, used sparingly)
```

Fonts: Inter (sans-serif) + JetBrains Mono (code). Loaded via `next/font/google`.

## Streaming

Chat responses stream token by token over SSE. The flow:

1. `useChat.send()` POSTs to `/chat`
2. Response body is piped through `parseSSEStream()` (async generator in `lib/sse.ts`)
3. Each `token` event appends to the message content in React state
4. `sources` event attaches citations to the message
5. `followups` event attaches suggested follow-up questions
6. `title` event updates the conversation title in the sidebar
7. `done` marks streaming as complete

## Anonymous Mode

Users can send 5 messages without creating an account. After that, a banner prompts them to sign up. The API enforces the same limit server-side and returns a 401 with `{ code: "ANON_LIMIT" }` when exceeded.

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| Cmd+K | Focus the input |
| Cmd+B | Toggle sidebar |
| Cmd+Shift+N | New conversation |

## Running Locally

```bash
pnpm dev:web
# Starts on http://localhost:3000
# Needs the API running on http://localhost:8787
```

## Deploying

The project is connected to Vercel via GitHub. Pushing to `main` triggers an automatic deploy.

Required environment variable in Vercel:
```
NEXT_PUBLIC_API_URL=https://instigpt-api.instigpt.workers.dev
```

Vercel settings:
- Root directory: `apps/web`
- Framework preset: Next.js
