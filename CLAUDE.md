# MyHealthVault

A demo of a patient-controlled health history app. Made-up patient data only.

## Read these first

- Design (the authority): `docs/superpowers/specs/2026-11-14-myhealthvault-design.md`
- Plan: `docs/superpowers/plans/2026-11-15-myhealthvault.md`
- Rules for look and words: `docs/rules/no-slop.md`
- Contracts: `src/domain/types.ts`, `supabase/migrations/`, `docs/contracts/`
- Design direction and tokens: `docs/design/direction.md`, `src/styles/tokens.css`

## Who does what

The architect (the main session, on Fable) plans, writes briefs, applies migrations, deploys and accepts work. Builders and reviewers are the agents in `.claude/agents/`. Builders write code; they do not change contracts, apply migrations, deploy or change project settings.

## Constraints on every task

- Zero running cost. No paid API, no billing-enabled key.
- Demo data only. Fictional patient, fictional provider names, no real hospital names.
- The app never states or implies medical advice. No language model writes the health summary.
- Nothing is saved from a scan without the user confirming it. Unreadable fields stay empty, never guessed.
- All user-facing text lives in `src/copy/`. No readable string literal in a component.
- Sentence case, no exclamation marks, no em dashes in user-facing text.
- One date format: `14 Nov 2026`, through `formatDate`.
- Touch targets at least 44px. Screens checked at 360, 768 and 1440 wide.
- Every screen has designed empty, loading and error states.
- Colours, type, spacing and radius come only from `src/styles/tokens.css`.
- Pure logic goes in `src/domain/` with a test beside it. Only `src/data/` talks to Supabase.

## Commands

- `npm test`: unit tests (Vitest)
- `npm run check:slop`: fails on banned phrases, styles and stray text
- `npm run test:e2e`: Playwright
- `npm run test:integration`: tests against the Supabase project
- `npm run build`: production build

Run `npm test` and `npm run check:slop` before handing in any task.

## Projects

- Supabase project ref: `waqlvbmsbgtqmcpeckzv`
- Vercel project: `myhealthvault`
- Repository: `Ramyl-Salazar/myhealthvault`
