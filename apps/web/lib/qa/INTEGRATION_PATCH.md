# Q&A V1a — Integration Patch Manifest

This document lists the **minimum set of edits to existing files** required to wire the Q&A system into the platform. Every other file added by V1a is brand-new and does not touch existing code.

**Total existing-file edits: 3.** Each is one or two lines.

---

## 1. `packages/db/src/schema/index.ts` — export the Q&A schema

Add one line to the existing exports list (order doesn't matter; place it with the other domain modules):

```ts
// Sales Intelligence Q&A
export * from "./qa";
```

This is the only edit needed to make the Drizzle schema visible to the rest of the app. Safe to remove (restores pre-V1a state).

---

## 2. Sales Dashboard nav — conditionally render the Q&A tab

The exact file depends on how the tabs are rendered in your Sales Dashboard (the existing one with Calls / Texts / Emails / DMs / FB Posts). Find that nav component and add one entry gated on the env flag.

Example pattern (React):

```tsx
// Existing imports...
import { isQaEnabled } from "@/lib/qa/env";

// Inside the nav tabs array:
const tabs = [
  { label: "Calls",    href: "/admin/calls" },
  { label: "Texts",    href: "/admin/texts" },
  { label: "Emails",   href: "/admin/emails" },
  { label: "DMs",      href: "/admin/dms" },
  { label: "FB Posts", href: "/admin/fb-posts" },
  // New tab — only rendered when the flag is on
  ...(isQaEnabled() ? [{ label: "Q&A", href: "/admin/qa" }] : []),
];
```

If the nav is a server component, the flag check is server-side and fine as-is. If it's a client component, expose the flag value via a server prop or a `NEXT_PUBLIC_ENABLE_QA_SYSTEM` mirror — but DO NOT check the secret in the client.

---

## 3. `apps/web/lib/env.ts` (optional) — add Q&A env specs to startup validation

The existing env validator in `apps/web/lib/env.ts` is a protected core file and was NOT modified. If you want the app to fail loudly at startup when `ENABLE_QA_SYSTEM=true` but `ANTHROPIC_API_KEY` is missing, add these entries to the `ENV_SPECS` array:

```ts
// ── Q&A System ────────────────────────────────────────────────────────────
{
  key: "ENABLE_QA_SYSTEM",
  required: false,
  productionOnly: false,
  validValues: ["true", "false"],
},
{
  // Required only when ENABLE_QA_SYSTEM=true. We enforce this in the route
  // guard rather than the startup validator, so this spec is a documentation
  // aid only.
  key: "ANTHROPIC_API_KEY",
  required: false,
  productionOnly: false,
},
{
  key: "DISABLE_QA_AI",
  required: false,
  productionOnly: false,
  validValues: ["true", "false"],
},
```

This edit is strictly optional. The Q&A routes already throw a clear error at call time if `ANTHROPIC_API_KEY` is missing.

---

## 4. Environment variables to set in Vercel

In the **staging** Vercel project first (production second, after validation):

| Variable                          | Required | Value / example                          |
|-----------------------------------|----------|------------------------------------------|
| `ENABLE_QA_SYSTEM`                | ✅       | `false` initially; flip to `true` to activate |
| `ANTHROPIC_API_KEY`               | ✅ (when flag on) | `sk-ant-...`                       |
| `QA_ANSWER_MODEL`                 | optional | defaults to `claude-sonnet-4-6`          |
| `QA_INGESTION_MODEL`              | optional | defaults to `claude-haiku-4-5-20251001`  |
| `QA_DAILY_CAP_PER_AGENT`          | optional | defaults to `200`                        |
| `DISABLE_QA_AI`                   | optional | `true` to kill AI generation but keep threads/replies working |
| `QA_EMBEDDING_OPENAI_KEY`         | optional | Only needed when V2 ships semantic search |

---

## 5. Apply the SQL migrations

Run the three migration files against staging Supabase first:

```
supabase/migrations/048_qa_tables.sql
supabase/migrations/049_qa_indexes.sql
supabase/migrations/050_qa_rls.sql
```

The rollback script is `supabase/migrations/048_qa_rollback.sql`.

Prerequisites:
- Postgres extensions `pgcrypto` and `vector` (both enabled by the migrations themselves).
- A working `is_admin()` helper function for RLS — per the HomeReach pattern. If it does not exist, the RLS policies in `050` will fail to create; either define the helper first, or temporarily comment out the RLS policies and rely on service-role access only.

---

## 6. Cutover sequence (per Section 14 of the blueprint)

1. Merge the V1a branch to main (flag off everywhere).
2. Deploy to staging. Confirm the Sentinel health endpoint stays GREEN 9/9.
3. Apply migrations 048–050 against staging Supabase.
4. Flip `ENABLE_QA_SYSTEM=true` in staging.
5. Walk the validation checklist in `STAGING_VALIDATION.md`.
6. Report proof to Jason for sign-off.
7. On approval, apply migrations to production, set env in production, flip flag.
