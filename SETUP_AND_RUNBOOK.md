# Setup And Runbook

Generated: 2026-05-09

Scope: exact commands for the new laptop. Do not run production-affecting commands until approved.

## Package Manager

Use pnpm. The repo declares:

- packageManager: pnpm@9.15.0
- Node engine: >=20.0.0
- pnpm engine: >=9.0.0

pnpm-lock.yaml exists. package-lock.json and yarn.lock were not found. Do not use npm or yarn for install.

## Local Tooling Observed

Found on PATH in this shell:

- node.exe from the Codex bundled runtime, version metadata 24.14.0.0.
- git.exe from system Git, version metadata 2.54.0.1.

Not found on PATH:

- pnpm
- npm
- corepack
- supabase
- vercel

Recommendation: install normal system Node LTS 20 or 22, then activate pnpm 9.15.0.

## Location Warning

The repo is currently inside OneDrive:

```text
C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach
```

Do not run install/build here. Move or copy to a non-synced folder first, such as:

```powershell
mkdir C:\Dev
robocopy "C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach" "C:\Dev\homereach" /E /XD node_modules .next .turbo .codex-next .codex-next-smoke _codex_runtime _codex_checkpoints
```

Use /E first. Use /MIR only after confirming the destination has nothing important.

## Install Prerequisites

```powershell
node -v
pnpm -v
git --version
```

If corepack is available after installing Node:

```powershell
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm -v
```

## Install Command

Run only after moving out of OneDrive:

```powershell
pnpm install --frozen-lockfile
```

If pnpm wants to modify pnpm-lock.yaml unexpectedly, stop and review.

## Dev Command

Preferred:

```powershell
pnpm --filter @homereach/web dev
```

Turbo equivalent:

```powershell
pnpm turbo run dev --filter=@homereach/web...
```

Expected local URL: http://localhost:3000 unless the port is already used.

## Build Command

Web-only production-like build:

```powershell
pnpm turbo run build --filter=@homereach/web...
```

Root build:

```powershell
pnpm build
```

## Typecheck Command

```powershell
pnpm turbo run type-check --filter=@homereach/web...
```

Root typecheck:

```powershell
pnpm type-check
```

Known errors already exist; see NEW_LAPTOP_HEALTH_CHECK.md.

## Lint Command

```powershell
pnpm turbo run lint --filter=@homereach/web...
```

Root lint:

```powershell
pnpm lint
```

## Test Command

No root test script was found. packages/services has Vitest:

```powershell
pnpm --filter @homereach/services test
```

Before relying on tests, confirm they do not require live provider credentials.

## Database Commands

Drizzle package scripts:

```powershell
pnpm --filter @homereach/db db:generate
pnpm --filter @homereach/db db:migrate
pnpm --filter @homereach/db db:studio
```

Approval required before db:migrate or any command that connects to/mutates remote DB.

## Supabase Commands

After installing Supabase CLI and after approval:

```powershell
supabase --version
supabase migration list
```

If linking is needed, ask first:

```powershell
supabase link --project-ref <project-ref>
```

Do not run reset, db push, db pull, migration repair, or production migrations without an approved plan.

## Vercel Commands

After installing Vercel CLI and after approval:

```powershell
vercel --version
vercel env ls
vercel build
```

Do not deploy or mutate env vars before local build and env reconciliation pass.

## Commands To Avoid Until Reviewed

- pnpm clean: root script uses Unix find/rm patterns and is risky on Windows/OneDrive.
- packages/db validation scripts using service-role env.
- Mailgun bounce import scripts.
- Agent/automation cron routes that may send or mutate sales data.
- Any live Stripe, Twilio, Supabase, Vercel, Facebook, or email-provider action without approval.