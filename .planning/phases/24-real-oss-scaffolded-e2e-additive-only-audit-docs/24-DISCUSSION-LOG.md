# Phase 24: Real-OSS + scaffolded e2e, additive-only audit, docs - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-11
**Phase:** 24-real-oss-scaffolded-e2e-additive-only-audit-docs
**Mode:** `--auto --analyze --chain` (autonomous single-pass; recommended options auto-selected without AskUserQuestion; `--analyze` trade-off tables recorded below for the audit trail)
**Areas discussed:** Real-clone e2e substrate + topology, ACV-02 scaffolded-workspace provisioning, Additive-only audit mechanism, ACV-03 coverage strategy, Docs (ACD-01)
**Mid-pass user directive (2026-07-11):** include `realworld-angular/realworld-angular` as a 2nd on-stack real clone, AFTER `bluehalo/ngx-leaflet` — applied to D-01.

---

## Real-clone e2e substrate + topology (ACV-01)

**Trade-off analysis: which real OSS `angular.json` clone(s), and how automated**

| Option | Pros | Cons |
|--------|------|------|
| `bluehalo/ngx-leaflet` only (app+lib, on-stack Ng22, MIT) — the Phase-21 GATE A' clone | Proven substrate; app+lib gives per-project scoping; single repo to maintain | One repo's confidence only |
| ngx-leaflet FIRST, then `realworld-angular` (exact-stack Ng22.0/TS6.0.3, MIT) | Two on-stack real repos = breadth/confidence; realworld is a clean exact-stack app | realworld likely app-only (no lib coverage); a 2nd clone to fetch/pin |
| Research SUMMARY's original pair (realworld-angular + off-stack Ng21 `angular-realworld-example-app`) | Cross-version breadth | Off-stack Ng21 DROPPED 2026-07-10; contradicts the on-stack-only lock |

Recommended (auto-selected, then USER-AMENDED): initially auto-locked `bluehalo/ngx-leaflet` only (ROADMAP SC1). **User directive 2026-07-11 amended it** to `ngx-leaflet` FIRST + `realworld-angular` AFTER (both on-stack Ng22). Off-stack Ng21 stays dropped.

**Choice:** `bluehalo/ngx-leaflet` (1st, app+lib) then `realworld-angular/realworld-angular` (2nd, on-stack) — see D-01. ACV-01 is a MANUAL/local milestone-FINAL gate (clones are uncommitted); reproduction = URL + SHA.
**Notes:** ACV-02 (a NEW dedicated e2e project mirroring install-e2e's Verdaccio/tarball machinery) is the CI-authoritative real-repo proof; a 4th e2e project inherits the shared-tarball `--parallel=1` + `typecheck-e2e` guard contract (D-03).

---

## ACV-02 scaffolded-workspace provisioning (RF-01 — research flag)

**Trade-off analysis: how to provision the "freshly scaffolded" Angular CLI workspace on-stack in CI**

| Option | Pros | Cons |
|--------|------|------|
| (A) Scaffold at test setup, PINNED `@angular/cli@22` + `ng g library` | Genuinely "fresh"; matches ACV-02 wording | Network dependency; slower; must pin to stay on-stack |
| (B) Commit a pre-scaffolded PINNED Ng22 `angular.json` fixture under `e2e/<proj>/fixtures/`, install the tarball into it | Deterministic; no network; on-stack by construction; matches existing e2e fixture layout | Must regenerate on Angular bumps (drift note) |
| (C) Live `npm init @angular@latest` | Truly latest | Drifts OFF the locked Angular-22 stack; flaky |

Recommended (auto-selected, NOT locked — RF-01): **(B)** committed pinned fixture for CI determinism + on-stack guarantee (this dev repo runs `.npmrc legacy-peer-deps=true` for its own Ng22-on-Nx23 pinning; a live `@latest` scaffold would drift). Resolve empirically in research.

**Choice:** RF-01 = research flag with hypothesis (B). Not a settled lock.
**Notes:** open sub-question for the researcher — does `ng add angular-typechecker` behave across npm/pnpm/yarn the way `nx add` does (cf. pnpm build-approval friction in the nx-add memory)? `ng add` is a different install path; confirm.

---

## Additive-only audit mechanism (ACP-02)

**Trade-off analysis: how to enforce + audit additive-only**

| Option | Pros | Cons |
|--------|------|------|
| Cross-check EXISTING surface-regression / schema-parity / manifest guards + a git-diff review vs the `0.2.0` tag | Zero new code; the guards already ENFORCE the key invariants; audit is a phase artifact | Relies on a human/agent diff read for the barrel/schemas |
| Add a NEW automated public-API/barrel snapshot guard | Mechanical, permanent | May duplicate existing guards; only worth it if a seam is unguarded |

Recommended (auto-selected): cross-check existing guards + diff audit (D-04); add a barrel snapshot spec ONLY if the audit finds an unguarded seam (RF-02).

**Choice:** D-04 (audit via existing guards + diff) locked; RF-02 (whether to add a new snapshot guard) left as a research flag.
**Notes:** Phase 24 ships no new public surface (D-07), so ACP-02 is trivially true for the phase's own changes; the audit confirms Phases 21-23 stayed additive.

---

## ACV-03 coverage strategy

**Trade-off analysis: build new coverage vs audit-and-fill**

| Option | Pros | Cons |
|--------|------|------|
| Audit the Phase 21-23 in-repo coverage + fill only genuine gaps | No duplicate specs; targeted | Requires a careful coverage read |
| Author a fresh ACV-03 suite from scratch | Self-contained | Duplicates the multi-tsconfig-array / configuration-angular-cli / ng-add / init specs |

Recommended (auto-selected): audit-and-fill (D-05). Candidate genuine gap: a builder-over-`BuilderContext` execution test asserting `BuilderOutput.success` + diagnostics parity (today `builder.spec.ts` asserts structural + brand parity, not a full run).

**Choice:** D-05 — audit existing, fill only the confirmed gap.
**Notes:** researcher confirms the exact gap; planner fills only what is missing.

---

## Docs (ACD-01)

**Trade-off analysis: README `## Angular CLI` scope + CHANGELOG**

| Option | Pros | Cons |
|--------|------|------|
| Full `## Angular CLI` section (ACD-01 enumerated contents) + curated prose-only CHANGELOG | Complete end-user coverage; matches the `## Storybook` precedent | — |
| Minimal note only | Less to maintain | Under-documents the new surface (fails ACD-01) |

Recommended (auto-selected): full section (D-06), end-user language only, prose-only CHANGELOG (no release cut — that is the separate Release-PR).

**Choice:** D-06. Section placement + exact wording = planner discretion.
**Notes:** the consumer `--legacy-peer-deps` note for OFF-STACK Angular (<22) stays even though the off-stack e2e tier was dropped — it is consumer guidance, not a test tier. `scoped-name-guard` polices the README on every PR.

---

## Claude's Discretion

- Plan decomposition (e2e / audit+gap-fill / docs split or combined).
- The new e2e project's exact name.
- Which planted diagnostics prove per-project scoping (app + spec + library; distinct-per-leaf attribution).
- README `## Angular CLI` placement + exact CHANGELOG wording (end-user language).

## Deferred Ideas

None new — discussion stayed within phase scope. Already-tracked deferrals (WALK-FUT-01 `createNodesV2`; wider off-stack Angular support; JSON/SARIF reporters; `NgtscProgram` incremental; standalone CLI) live in `REQUIREMENTS.md`.
