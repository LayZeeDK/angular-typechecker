# Phase 29: Docs - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-17
**Phase:** 29-docs
**Mode:** `--auto --analyze --chain` (autonomous single pass; recommended option auto-selected per gray area, trade-off tables logged for audit)
**Areas discussed:** Section placement, Installation methods, `atc` supply-chain guidance, Flag reference format, Exit-code table, CHANGELOG entry

---

## Section placement

| Option | Description | Selected |
|--------|-------------|----------|
| After `## Angular CLI`, before `## Storybook` | Groups the three adapters (Nx / Angular CLI / CLI) in adapter order | ✓ |
| End of README, before `## Limitations` | Treats the CLI as a trailing addendum | |
| Top, right after `## Quick start` | Elevates the CLI above the Nx-primary flow | |

**Auto-selected:** After `## Angular CLI`, before `## Storybook`.
**Notes:** LOW impact (reversible prose ordering), HIGH confidence. The milestone frames the CLI as "a third thin adapter over the same core", so adapter grouping is the natural order. ToC entry added to match (D-02).

---

## Installation methods

| Option | Description | Selected |
|--------|-------------|----------|
| `npx angular-typechecker` canonical + installed-bin shorthand | Zero-install path first, then dev-dependency install | ✓ |
| Global install only | `npm i -g` | |
| Dev-dependency only | No npx path shown | |

**Auto-selected:** `npx angular-typechecker` canonical (uninstalled) + install-then-bin (`atc` shorthand).
**Notes:** Locked by SC#2. HIGH confidence.

---

## `atc` supply-chain guidance

| Option | Description | Selected |
|--------|-------------|----------|
| `npx angular-typechecker` only; `atc` as post-install shorthand + explicit `npx atc` warning | Never instruct `npx atc`; note `atc@0.0.6` is unrelated | ✓ |
| Document `npx atc` as an equal alias | Would fetch the wrong package | |

**Auto-selected:** `npx angular-typechecker` only; `atc` is a post-install PATH shorthand; explicit note that `npx atc` fetches the unrelated `atc@0.0.6`.
**Notes:** LOAD-BEARING, locked by SC#2. MEDIUM impact (supply-chain hazard) but direction fully locked -> HIGH confidence.

---

## Flag reference format

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror the CLI `HELP_TEXT` verbatim (single source of truth) | README and `--help` never drift | ✓ |
| Hand-write a fresh table | Risks drift from `--help` | |

**Auto-selected:** Mirror `HELP_TEXT` (`parse-args.ts` 64-82). Rendering (list vs table) left to planner.
**Notes:** LOW impact, HIGH confidence.

---

## Exit-code table

| Option | Description | Selected |
|--------|-------------|----------|
| Own `0`/`1`/`2` table, reconciled with existing `## Exit codes` | CLI is first adapter to own literal `2` | ✓ |
| Reuse the existing pass/fail-only text | Would hide the CLI's literal `2` | |

**Auto-selected:** New `0`/`1`/`2` contract table; explicitly note the CLI splits `1` vs `2` where Nx/ng collapse both to non-zero.
**Notes:** Locked by SC#1. HIGH confidence.

---

## CHANGELOG entry

| Option | Description | Selected |
|--------|-------------|----------|
| Curated `## 0.2.2` entry, end-user language, no internal ids | Matches `## 0.2.1` shape | ✓ |
| Raw nx-generated dump | Leaks plan-id scopes | |

**Auto-selected:** Curated `## 0.2.2` entry (lead paragraph + `### Features` / `### Notes` / `### Compatibility`), consumer language, no internal ids/scopes.
**Notes:** Locked by SC#3 + changelog-hygiene rule. HIGH confidence.

---

## Claude's Discretion

- Table-vs-list rendering for the flag reference; exact prose wording; whether to include a short worked npx example.

## Deferred Ideas

- `--watch` mode docs (CLIX-01 deferred — no incremental engine yet).
- A top-of-README "three ways to run it" comparison (only if it falls out naturally; `## How it compares` already covers the comparison).
