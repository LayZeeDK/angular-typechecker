---
phase: 29
slug: docs
status: verified
asvs_level: 1
threats_found: 2
threats_closed: 2
threats_open: 0
created: 2026-07-17
---

# Phase 29 -- Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Mode: VERIFY (register authored at plan time in the 29-01 `<threat_model>` block;
> `register_authored_at_plan_time: true`). Each declared mitigation was confirmed
> present in the shipped docs and enforced by the CI doc-tripwire -- not accepted on
> documentation intent. No blind scan for new threats.
>
> Scope note: this is a PURE-DOCUMENTATION phase. No code path, no runtime input, no
> package install, and no product trust-boundary change. The diff is a README section,
> a curated CHANGELOG entry, and one deterministic fs-read spec. The only
> security-relevant dimensions are supply-chain / typosquat avoidance in the copyable
> install commands (T-29-01) and public-changelog information hygiene (T-29-02). ASVS
> L1 categories (auth, session, access control, crypto, input validation) are N/A.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| docs -> reader's shell | A reader copies a command from the README / CHANGELOG and executes it. A wrong or ambiguous invocation string (e.g. `npx atc`) crosses into arbitrary code execution on the reader's machine by fetching an unrelated published package. | copyable install / run command strings |
| internal artifacts -> public release notes | The curated `## 0.2.2` CHANGELOG entry feeds the public GitHub Release notes. An internal id/scope leaking into it exposes internal phase/plan structure to consumers. | CHANGELOG entry prose |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-29-01 | Spoofing / Tampering | README `## Standalone CLI` install docs | mitigate | Docs present `npx angular-typechecker` as the ONLY uninstalled invocation; `atc` appears solely as a post-install PATH alias with an explicit inline warning naming the unrelated `atc@0.0.6` package. The doc-tripwire asserts `not.toContain('npx atc')` over the README so the hazard cannot reappear without failing CI. | closed |
| T-29-02 | Tampering | CHANGELOG `## 0.2.2` public entry | mitigate | Changelog-hygiene: end-user language only, no internal ids/scopes. The doc-tripwire regex-asserts no internal-id leak over the `## 0.2.2` entry slice so a leak into the public changelog / GitHub Release notes fails CI. | closed |

*Status: open . closed*
*Disposition: mitigate (implementation required) . accept (documented risk) . transfer (third-party)*

---

## Accepted Risks Log

None this phase. Both declared threats are `mitigate` and every mitigation was
confirmed present in the shipped docs and enforced by the CI doc-tripwire.

(The `atc` bin-name collision with the unrelated `atc@0.0.6` was accepted as
`AR-27-03` in Phase 27's SECURITY.md and does not resurface here. Phase 29's T-29-01
mitigation -- document `atc` only as a post-install alias and NEVER through `npx` --
is the documentation-side control that keeps that accepted risk contained for readers,
and it is verified present.)

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-17 | 2 | 2 | 0 | gsd-security-auditor |

### Evidence log (VERIFY mode -- direct doc / spec inspection, not intent)

- **T-29-01** (plan 29-01):
  - `packages/angular-typechecker/README.md:474` `## Standalone CLI` heading; ToC anchor
    `[Standalone CLI](#standalone-cli)` at :42.
  - The ONLY uninstalled invocation is the canonical zero-install form:
    `npx angular-typechecker -c <tsconfig>` (:484-488), reiterated as "The only
    uninstalled invocation is `npx angular-typechecker`" (:514-515).
  - `atc` appears SOLELY as a post-install `PATH` alias: `atc -c tsconfig.json` shown
    only after a local `npm install` / `pnpm add -Dw` (:503-509).
  - Explicit inline supply-chain warning naming the unrelated package: "never run it
    through `npx` ... fetches an unrelated published package (`atc@0.0.6`, a 2013
    'Manage fleet spawns' package) ... a supply-chain hazard" (:511-514).
  - CHANGELOG mirrors the same guard for the release-notes surface: `CHANGELOG.md:32-35`
    ("do not run it through `npx`, because that fetches an unrelated published package
    (`atc@0.0.6`)").
  - Enforcement: `packages/angular-typechecker/src/standalone-cli-docs.spec.ts:57-64`
    asserts `expect(normalized).toContain('npx angular-typechecker')`,
    `expect(normalized).not.toContain('npx atc')`, and
    `expect(normalized).toContain('atc@0.0.6')`. Non-tautological: the guard runs over
    the ACTUAL README content (`normalized`), and the co-located positive assertions
    prove the section is non-empty -- a reappearance of the literal `npx atc` (including
    a line-wrapped `npx\natc`, collapsed by the `\s+` normalize) fails CI. Mirrors the
    same guard in `src/cli/parse-args.spec.ts:179,186`.
  - Independent confirmation: `git grep -F "npx atc"` over `README.md` + `CHANGELOG.md`
    returns ZERO hits (exit 1). The literal `npx atc` appears NOWHERE in either file.

- **T-29-02** (plan 29-01):
  - `CHANGELOG.md:5-40` carries the curated `## 0.2.2` entry above `## 0.2.1` (undated,
    matching `## 0.2.1`), in end-user language: bold lead + `### Features` /
    `### Notes` / `### Compatibility`. Direct read confirms NO internal id/scope
    (`DOC-01`, `CLI-0x`, `SC#`, `Phase 29`, plan numbers, or board/layout jargon)
    appears anywhere in the entry.
  - Enforcement: `standalone-cli-docs.spec.ts:85-98` reads the repo-root CHANGELOG,
    slices from `## 0.2.2` to the next `## 0.2.1`, and asserts
    `expect(entry).not.toMatch(/DOC-01|CLI-0\d|SC#|\bphase\b/i)`. Non-tautological: the
    slice is guarded by `expect(next).toBeGreaterThan(start)` (:95), so a missing/moved
    `## 0.2.1` boundary can't silently yield an empty or backwards slice that passes the
    regex vacuously; and `expect(changelog).toContain('## 0.2.2')` (:87) proves the
    entry exists to be scanned.

- **CI wiring**: the tripwire is a standard `.spec.ts` under
  `packages/angular-typechecker/src/`, executed by `nx test angular-typechecker`. The
  29-01 SUMMARY records it running green in the phase gate battery (44 files / 447
  tests, including this new spec), so both mitigations are enforced on every PR --
  including a docs-only one.

### Unregistered flags

None. The 29-01 SUMMARY carries no `## Threat Flags` section and flags no new attack
surface. Consistent with `register_authored_at_plan_time: true`: the register is
complete and closed at plan time, and this pure-docs phase introduced no code path,
runtime input, package install, or product trust boundary that could constitute an
unmapped surface.

### Public-repo hygiene

Allowlist-inversion review of the phase's authored + modified files (README section,
CHANGELOG entry, the new spec, and this artifact) found no maintainer work email or its
bare domain. The authored security prose contains no email-shaped tokens.

---

## Sign-Off

- [x] Both threats have a disposition (both `mitigate`)
- [x] No accepted risks required this phase (both threats mitigated in docs + enforced by the CI tripwire)
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter
- [x] Implementation files unmodified (only 29-SECURITY.md authored)

**Approval:** verified 2026-07-17
