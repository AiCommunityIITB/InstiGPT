# @instigpt/shared

TypeScript types and utilities shared between the API and frontend.

Both `apps/api` and `apps/web` import from here. This avoids duplicating type definitions and ensures the API contract stays in sync on both sides.

## Contents

- User, Session, Conversation, Message types
- Source, Entity, Relationship, Chunk types (knowledge base)
- API request/response types (ChatRequest, ChatStreamEvent, etc.)
- `parseRollNumber()` utility for IIT Bombay roll numbers

## Roll Number Format

IITB roll numbers follow the pattern `YYXDDNNN`:
- `YY` = admission year
- `X` = program code (1=BTech, 2=MTech, 3=PhD, 4=Dual, etc.)
- `DD` = department code (07=CSE, 02=EE, 03=Mech, etc.)
- `NNN` = serial number

`parseRollNumber("210070042")` returns `{ year: 2021, program: "BTech", department: "Computer Science & Engineering" }`.

## Building

```bash
pnpm build
# Compiles TypeScript to dist/
```

When adding new shared types, rebuild this package first before running
the API or frontend, otherwise TypeScript will complain about missing exports.
