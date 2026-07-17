---
phase: 27
slug: bin-shell-cross-platform-packaging
status: verified
asvs_level: 1
threats_found: 9
threats_closed: 9
threats_open: 0
created: 2026-07-16
---

# Phase 27 -- Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Mode: VERIFY (register authored at plan time across 27-01/02/03 `<threat_model>`
> blocks). Each declared mitigation was confirmed present in the implemented code --
> not accepted on documentation or intent. No blind scan for new threats.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| shell -> bin.ts (`process.argv`) | Untrusted CLI args cross into the process. bin.ts forwards them to `run()`, which reads tsconfigs via the ts/fs API -- never a shell. | CLI argv strings (low sensitivity) |
| bin.ts -> npm/pnpm/yarn `.bin` shim | The `bin` field is what package managers turn into installable command shims. | package manifest `bin` map |
| build host -> published bin.js | The compiled shebang must survive with LF bytes to run on Linux/macOS from a Windows arm64 build host. | compiled `bin.js` bytes |
| dist -> packed tarball (published artifact) | `npm pack` applies the `files` allowlist; the audit reads the REAL shipped manifest + bin.js, not the source tree. | published tarball contents |
| released 0.2.1 contract -> HEAD | The additive-only audit compares the public surface at the last shipped tag against HEAD to catch an accidental breaking change before release. | public API / schemas / executor id |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-27-01 | Tampering | `bin.ts` shebang CRLF on the Windows arm64 build host | mitigate | `newLine: "lf"` (tsconfig.lib.json:7) + `*.ts text eol=lf` (.gitattributes:7); proven by dist byte-check | closed |
| T-27-02 | Denial of Service | `src/cli/**` import graph reaching `@nx/*`/nx (24-06 chalk-chain crash on a non-Nx consumer) | mitigate | `**/src/cli/**/*.ts` ESLint import-ban (eslint.config.mjs:76-125) + static require-graph walk (bin-static.spec.ts:122-127); bin.ts imports only `./main` (bin.ts:9) | closed |
| T-27-03 | Elevation of Privilege / Spoofing | `atc` bin name collides with unrelated `atc@0.0.6` on npm | accept (informational) | Ships both bin names; docs/`--help` steer to `npx angular-typechecker`. Naming only, not HIGH. Logged in Accepted Risks. | closed |
| T-27-04 | Tampering | `process.exit` truncating a piped stdout tail (dropped `TSxxxx` = silent wrong verdict) | mitigate | D-02: `process.exitCode` + natural drain, NEVER `process.exit` (bin.ts:25, bin.ts:33); the only `process.exit(` token is a comment (bin.ts:22) | closed |
| T-27-05 | Tampering | CRLF shebang or nx-in-graph regression shipping undetected | mitigate | Dist byte-check + require walk (bin-static.spec.ts:115-127) + published-tarball shebang + `publint --strict` (tarball-audit.e2e.spec.ts:167-177, 238-259) | closed |
| T-27-06 | Tampering / Malicious Code | Install lifecycle script sneaking into the published tarball (s1ngularity vector) | accept (already guarded) | `INSTALL_SCRIPT_KEYS` tarball-audit assertion unchanged + green (tarball-audit.e2e.spec.ts:61-67, 220-229); manifest has NO `scripts` key at all; bin adds no script. Logged in Accepted Risks. | closed |
| T-27-07 | Denial of Service | Published bin dragging `@nx/*`/nx transitively (crash on a non-Nx consumer) | mitigate | Static transitive require-graph walk proves built `bin.js` nx-free (bin-static.spec.ts:78-127). Runtime `require.cache` probe deferred to Phase 28 (VER-04). | closed |
| T-27-08 | Tampering / Repudiation | Accidental narrow/remove/rename of public API / executor id / builder / schema shipping as a patch (silent breaking change) | mitigate | Barrel-drift tripwire (`src/index.drift.ts` + `tsconfig.drift.json`, ride `nx typecheck`) + per-path `git diff angular-typechecker@0.2.1..HEAD`; verified empty diff on `src/index.ts`, `executors.json`, executor `schema.json`; 27-ADDITIVE-AUDIT.md records ADDITIVE-ONLY. | closed |
| T-27-SC | Tampering | npm/pip/cargo installs (supply chain) | mitigate | Zero new dependency/dev-dependency this phase -- the `bin` field is the only manifest addition (net-new, confirmed vs 0.2.1 tag). `publint` + `@arethetypeswrong/cli` already root devDeps. | closed |

*Status: open . closed*
*Disposition: mitigate (implementation required) . accept (documented risk) . transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-27-03 | T-27-03 | `atc` shares a name with the unrelated, unmaintained `atc@0.0.6` on npm. This is a local `.bin` shim name only -- no install-time execution, no network, no privilege change. Both official names (`angular-typechecker` + `atc`) map to one compiled `./src/cli/bin.js` (package.json:33-36); docs and `--help` steer users to `npx angular-typechecker`. Informational, not HIGH -- below the `block_on: high` gate. | Lars Gyrup Brink Nielsen (maintainer) | 2026-07-16 |
| AR-27-06 | T-27-06 | Install lifecycle scripts (`preinstall`/`install`/`postinstall`/`prepare`/`prepublish`) are the s1ngularity payload vector. This phase adds NO script: the plugin manifest has no `scripts` key at all, and the standing `INSTALL_SCRIPT_KEYS` tarball-audit assertion (tarball-audit.e2e.spec.ts:220-229) fails loudly if any such key ever appears in the packed manifest. Accepted as already-guarded: the bin work introduces no new install-time surface. | Lars Gyrup Brink Nielsen (maintainer) | 2026-07-16 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-16 | 9 | 9 | 0 | gsd-security-auditor |

### Evidence log (VERIFY mode -- direct code inspection, not documentation)

- T-27-01: `packages/angular-typechecker/tsconfig.lib.json:7` (`"newLine": "lf"`) + `.gitattributes:7` (`*.ts text eol=lf`). Direct byte proof: built `dist/packages/angular-typechecker/src/cli/bin.js` first line is `#!/usr/bin/env node\n` (bare LF, no `\r`) confirmed via `od -c`.
- T-27-02: `packages/angular-typechecker/eslint.config.mjs:76-125` (the `**/src/cli/**/*.ts` no-restricted-imports block banning `nx`, `@nx/devkit`, `@nx/*`, `@angular-devkit/*`, adapter modules, the barrel) + `bin-static.spec.ts:122-127` require-walk. `bin.ts:9` imports only `./main`.
- T-27-03: accepted risk AR-27-03; two-name `bin` map present at `package.json:33-36`.
- T-27-04: `bin.ts:25` and `bin.ts:33` set `process.exitCode`; `git grep` confirms no `process.exit(` call in `src/cli/*.ts` (only the comment at `bin.ts:22`).
- T-27-05: `bin-static.spec.ts:115-127` (dist shebang byte-check + require walk) + `tarball-audit.e2e.spec.ts:167-177` (`publint --strict`) + `:238-259` (two-name bin map + shipped `bin.js` `\r`-free shebang).
- T-27-06: accepted risk AR-27-06; `INSTALL_SCRIPT_KEYS` at `tarball-audit.e2e.spec.ts:61-67`, assertion at `:220-229`; no `scripts` key in the plugin manifest.
- T-27-07: `bin-static.spec.ts:78-112` (`collectNxRequires` transitive walk) + assertion at `:122-127` (`violations` empty).
- T-27-08: `src/index.drift.ts` + `tsconfig.drift.json` present; `git diff angular-typechecker@0.2.1..HEAD` empty on `src/index.ts`, `executors.json`, `src/executors/typecheck/schema.json`; `git cat-file` confirms `bin.ts` and the `bin` field absent at the 0.2.1 tag (net-new). Recorded in 27-ADDITIVE-AUDIT.md.
- T-27-SC: `package.json` dependencies unchanged (`@nx/devkit` 23.0.1, `nx` ^23.0.0, `tslib` ^2.3.0); only manifest addition is the `bin` field (additive audit leg c).

### Unregistered flags

None. No SUMMARY (27-01/02/03) carries a `## Threat Flags` section; no new attack surface appeared during implementation without a threat mapping.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log (AR-27-03, AR-27-06)
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-16
