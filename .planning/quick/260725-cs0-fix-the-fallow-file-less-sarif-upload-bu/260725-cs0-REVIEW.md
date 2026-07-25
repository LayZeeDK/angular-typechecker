---
quick_id: 260725-cs0
reviewed: 2026-07-25
depth: deep
files_reviewed: 3
files_reviewed_list:
  - tools/ci/normalize-fallow-sarif.mjs
  - packages/angular-typechecker/src/normalize-fallow-sarif.spec.ts
  - .github/workflows/ci.yml
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
status: issues_found
---

# Quick Task 260725-cs0: Code Review Report

**Reviewed:** 2026-07-25
**Depth:** deep (cross-file: ci.yml <-> script <-> spec <-> `sarif-report.ts` precedent <-> live GitHub API)
**Files Reviewed:** 3 (`1a0e73a`, `0ca59df`, `a8b25c1`; +341/-7 vs `origin/main`)
**Status:** issues_found -- **0 Critical, 2 Important, 5 Suggestions**

Severity mapping for downstream tooling: **Important == `warning` tier**, **Suggestion == `info` tier**.

## Verdict

**The change is correct for every shape fallow actually emits, and is a strict improvement over
`origin/main`. Nothing here blocks merge.** The transform, the `ci.yml` wiring, and the frozen
`fallow/<index>` id scheme all verify clean, and every load-bearing factual claim in the header
comment that is checkable against the GitHub API checked out TRUE (see "Fact-check results").

Two Important findings are hardening gaps in shapes fallow does not emit *today*: a MIXED
`locations` array still slips through unfixed (proven by running the real transform), and multiple
file-less clone groups will most likely collapse into ONE Code Scanning alert because the script
copies the anchor half of this repo's own file-less precedent but not its fingerprint half. Both are
cheap to close while the file is open.

## Verification performed (not just read)

| Check | Result |
| --- | --- |
| Ran the real `normalizeFallowSarif` over 6 adversarial inputs | See F-01 / clean-bill items below |
| `npx nx test angular-typechecker` | PASS -- 59 files / 593 tests |
| `npx nx lint angular-typechecker` (`maxWarnings: 0`, nx.json:24) | PASS -- confirms no `tools/ci` import |
| `npx prettier --check` on both new files | PASS |
| `node --check tools/ci/normalize-fallow-sarif.mjs` | PASS |
| Non-ASCII byte scan of all 3 files | 0 bytes > 127 in each |
| `gh api` on both cited CI runs + their jobs | Both exist; `Upload fallow SARIF` = `failure` in both |
| `gh api code-scanning/analyses?tool_name=fallow` | 98 analyses, 100% category `fallow`; **zero** at `e1d25ce9` and `8634c368` |
| `gh api code-scanning/alerts?tool_name=angular-typechecker-red-proof` | `ATC90002` @ `tools/sarif-proof-fixture/tsconfig.json` `start_line:1 start_column:1 end_line:1 end_column:1` |
| `npx fallow config-schema` (88283 bytes) knob scan | No sarif/location/anchor knob (5 `anchor` + 5 `location` hits are all unrelated prose) |
| `git grep` for guard specs pinning the old inline `node -e` | None -- `ci-e2e-coverage-guard.spec.ts` pins only the red-proof driver-name rewrite, untouched |

---

## Important

### IM-01: A MIXED `locations` array still ships the upload-killing shape -- and the header claims otherwise

**File:** `tools/ci/normalize-fallow-sarif.mjs:67-86`

```js
      const located = (result.locations ?? []).some(
        (location) =>
          typeof location?.physicalLocation?.artifactLocation?.uri ===
            'string' &&
          location.physicalLocation.artifactLocation.uri.length > 0,
      );
```

**What is wrong.** `.some()` asks "does ANY entry have a uri". GitHub derives an alert's
`most_recent_instance.location` from `result.locations[0]`, so an array whose FIRST entry lacks
`physicalLocation` is still location-deficient from GitHub's point of view -- and it passes this
predicate untouched. The comment two lines above states the opposite:

```js
      // One condition covers all three deficiency shapes -- `locations` key
      // absent (the only OBSERVED shape), `locations: []`, and an entry lacking
      // `physicalLocation` -- because GitHub enforces `physicalLocation` +
      // `artifactLocation.uri` and all three fail it.
```

It covers "an entry lacking `physicalLocation`" only when that is the ONLY entry. `ci.yml:606` repeats
the overstatement ("gives **every** location-deficient result a region-less anchor").

**Evidence (ran the shipped transform, not a paraphrase):**

```
mixed[bad,good] -> {"runs":[{"results":[{"ruleId":"x",
  "locations":[{},{"physicalLocation":{"artifactLocation":{"uri":"a.ts"}}}]}],
  "automationDetails":{"id":"fallow/0"}}]}
```

`locations[0]` is still `{}`. The script's entire reason to exist is that ONE deficient result costs
EVERY fallow alert, so the one shape it silently passes through is the one worth closing.

Note the error string `locationFromSarifResult: expected at least one location` genuinely reads like
an emptiness check, so the mixed case is a judgement call about an unproven code path -- which is
exactly why the conservative transform is preferable to the conservative *predicate*.

**Fix** (per-ENTRY normalization; same size, strictly safer, and the existing spec passes unchanged
because every fixture shape maps to an identical result):

```js
      const usable = (location) =>
        typeof location?.physicalLocation?.artifactLocation?.uri === 'string' &&
        location.physicalLocation.artifactLocation.uri.length > 0;

      // Normalize per ENTRY, not per result: GitHub reads the alert location from
      // `locations[0]`, so a MIXED array whose first entry is deficient is still
      // rejected. Never drops a usable entry, and an absent/empty array still gets
      // exactly one fallback.
      const locations = (result.locations ?? []).map((location) =>
        usable(location)
          ? location
          : { physicalLocation: { artifactLocation: { uri: FALLBACK_URI } } },
      );

      result.locations =
        locations.length > 0
          ? locations
          : [{ physicalLocation: { artifactLocation: { uri: FALLBACK_URI } } }];
```

Then drop "all three" from the header comment and from `ci.yml:606` ("every result", accurately).

**Related, informational (no change recommended).** A legal `artifactLocation` carrying
`uriBaseId` + `index` but no `uri` has its real location DESTROYED by the current code -- proven:

```
uriBaseId-only -> {"locations":[{"physicalLocation":{"artifactLocation":{"uri":".fallowrc.jsonc"}}}]}
```

The input's `region: { startLine: 9 }` is gone. fallow never emits that shape (research Finding 4:
84/84 located results carry a plain `uri`), so keeping the uri-based predicate is the right call --
just be aware the transform is lossy on it, and do not widen the predicate later without noticing.

---

### IM-02: Co-located file-less results carry no `partialFingerprints` -- multiple clone groups will most likely collapse into ONE alert

**File:** `tools/ci/normalize-fallow-sarif.mjs:83-85` (and header lines 28-30)

```js
        result.locations = [
          { physicalLocation: { artifactLocation: { uri: FALLBACK_URI } } },
        ];
```

**What is wrong.** fallow emits ONE result per clone group (`"Clone group 1 (44 lines, 2
instances)"`, research Finding 3) and -- per that same Finding -- omits `partialFingerprints` on
exactly these results. After this transform, N clone groups become N results with an IDENTICAL
`ruleId` (`fallow/code-duplication`), an IDENTICAL location (`.fallowrc.jsonc`, region-less ->
back-filled to line 1 col 1), and NO fingerprint. With `partialFingerprints` absent, GitHub falls
back to a location-derived fingerprint (`primaryLocationLineHash`), which does not include
`message.text` -- so all N results plausibly de-duplicate into a single alert and clone groups
2..N vanish from the UI.

That directly undercuts the locked decision the script is built on (PLAN must_have: *"No finding is
dropped"*). The finding survives in the SARIF; it is the ALERT that disappears.

**Evidence -- this repo already solved exactly this, and the header cites it as the model:**
`sarif-report.ts:216-226` anchors every file-less record at the tsconfig **and** writes a
self-computed fingerprint, and `fingerprintOf` (`sarif-report.ts:370-380`) hashes
`code + file + MESSAGE + line + column` -- the message being the only field that distinguishes two
co-located file-less records:

```ts
function fingerprintOf(record: DiagnosticRecord): string {
  const tuple = [record.code, record.file ?? '', record.message, ...].join('\n');
  return createHash('sha256').update(tuple, 'utf8').digest('hex');
}
```

So the header's claim at lines 28-30 --

```js
// mirrors the shipped reporter's own file-less fallback (core/sarif-report.ts
// anchors a file-less record at its tsconfig, region-less).
```

-- mirrors the anchor half only. The precedent is anchor **plus** fingerprint.

**Fix** (node builtins only, ~4 lines, mirrors the precedent's tuple):

```js
import { createHash } from 'node:crypto';

// ... inside the fallback branch, after assigning result.locations:
        // Every file-less result lands on the SAME anchor line, and fallow omits
        // partialFingerprints on exactly these results -- so without a synthesized
        // fingerprint GitHub's location-derived fallback would merge all clone
        // groups into one alert. Mirrors sarif-report.ts's fingerprintOf tuple.
        result.partialFingerprints ??= {
          normalizedFallowFingerprint: createHash('sha256')
            .update(`${result.ruleId ?? ''}\n${result.message?.text ?? ''}`, 'utf8')
            .digest('hex'),
        };
```

`??=` keeps every already-fingerprinted result byte-unchanged (spec assertion 2 stays green).

**Acceptable alternative:** decide this is fine (Code Scanning is reporting-only here; the `fallow`
job is the authoritative gate) and say so in the header instead of implying full parity with the
reporter's precedent. What is not acceptable is leaving the "mirrors the shipped reporter's own
file-less fallback" claim as-is while mirroring half of it -- that is the comment-rot class this
repo has been burned by.

---

## Suggestions

### SG-01: The header's cwd rationale is copied from `merge-sarif.mjs` and is not true here

**File:** `tools/ci/normalize-fallow-sarif.mjs:3-4`

```js
// region-less fallback location. Run from the repo ROOT (it reads/writes
// `fallow.sarif` relative to cwd) so `artifactLocation` URIs stay repo-relative.
```

The trailing clause is `merge-sarif.mjs:13-15`'s rationale, where it IS true (that script spawns the
CLI with `cwd: root`, so the CLI computes repo-relative URIs). This script computes no URI from cwd:
fallow's URIs are already in the file, and `FALLBACK_URI` is a hardcoded relative literal. cwd
affects only WHICH file is read/written. **Fix:** end the sentence at "relative to cwd)."

### SG-02: "all 98 existing analyses" is an undated snapshot count in a permanent comment

**File:** `tools/ci/normalize-fallow-sarif.mjs:45-46`

Verified TRUE right now (`gh api ... ?tool_name=fallow --paginate` -> 98 records, 100% category
`fallow`). But the count only grows, so a future reader hitting 130 will read the comment as stale
and may distrust the surrounding -- correct -- reasoning. **Fix:** "every existing analysis reports
exactly that (98/98 as of 2026-07-25)".

### SG-03: "the verbatim port of the inline `node -e`" -- effect-equivalent, not verbatim

**File:** `tools/ci/normalize-fallow-sarif.mjs:46-47`

The id SCHEME is byte-identical and the category is preserved (verified: `fallow/0` -> category
`fallow`), but the CODE is not a verbatim port -- `??` replaces `||` and `for...of .entries()`
replaces `forEach`. One observable divergence, exercised:

```
runs:0 (new)    -> THROWS TypeError: (doc.runs ?? []).entries is not a function
runs:0 (legacy) -> {"runs":0}   (silent no-op)
```

That input is impossible from fallow, and throwing under `bash -e` is the better behaviour for a CI
step -- so this is a correctness *improvement*, not a bug. Just say "an effect-equivalent port of"
so nobody later "restores" the `||`.

### SG-04: Spec assertions throw a TypeError instead of failing cleanly on the `locations: []` regression

**File:** `packages/angular-typechecker/src/normalize-fallow-sarif.spec.ts:177-182, 195-197`

```ts
          expect(
            result.locations?.[0].physicalLocation?.artifactLocation?.uri,
          ).toBeTruthy();
```

`?.[0]` short-circuits only when `locations` is nullish. Verified:

```
locations:[]     => THROWS Cannot read properties of undefined (reading 'physicalLocation')
locations:absent => undefined
locations:[{}]   => undefined
```

So if the transform regressed for the `locations: []` shape, run 2 fails with an opaque TypeError at
line 196 rather than the intended `expected undefined to be truthy`. The guard still fires (good --
not vacuous), but the diagnostic is worse. **Fix:** `result.locations?.[0]?.physicalLocation?...` at
all three sites (178, 181, 196).

### SG-05: Assertion 3's nested loop is silently vacuum-able for run 2, and the "one-line swap" claim now spans two files

**File:** `packages/angular-typechecker/src/normalize-fallow-sarif.spec.ts:193-199`; `tools/ci/normalize-fallow-sarif.mjs:35-38`

(a) Run 1 has `toHaveLength(1)` and run 0 has a deep-equal, but run 2's two results have no count
assertion -- so a future transform that DROPPED results would make the inner loop iterate zero times
for run 2 and still pass. "Never drops a result" is a locked decision (PLAN truth 2). One line closes
it:

```ts
      expect(output.runs.flatMap((run) => run.results)).toHaveLength(4);
```

(b) The header says the `package.json` fallback swap "stays a one-line change". It is one
load-bearing *code* line, but the spec pins the literal at line 179
(`.toBe('.fallowrc.jsonc')`), so the real swap is 2 files (plus 3 comment mentions: script:32,
spec:16, ci.yml:607). Pinning the value in the spec is correct -- just phrase the comment as "one
load-bearing line (the spec pins the expected value, so update it too)". Per the review brief this
is reported only because the claim is stated as proven-simple; the swap is NOT meaningfully harder
than intended.

---

## Clean bill (checked adversarially, found nothing)

- **`ci.yml` preservation.** The diff is exactly one script line plus two comment blocks. Byte-unchanged
  and re-verified in place: the `npx fallow audit ... || true` generation (615), `if [ -s fallow.sarif ]`
  (616), both `produced=true`/`produced=false` branches (618, 620), the
  `Assert fallow SARIF was produced (non-fork PR)` step incl. its `produced == 'false'` gate (642-646),
  the no-`category` fallow upload (658-666), the `head.repo.fork == false` gates (643, 654, 663), the
  `FALLOW_AUDIT_BASE` env (612-613), and every `angular-typechecker` / `angular-typechecker-red-proof`
  path (590-593, 631-635, 647-657, 727-807). No new action added, both `upload-sarif` uses stay on the
  same SHA pin. No guard spec pinned the removed inline `node -e`.
- **The frozen id scheme.** `fallow/${index}` is effect-identical to `"fallow/"+i`; category stays
  `fallow` (text before the final `/`), so no new `(analysis_key, category, environment)` tuple and no
  GATE-02 step 0 orphan hazard. Locked by spec assertion 4, which WOULD fail if fallow's
  `fallow/audit/dupes` were preserved.
- **Prototype pollution / untrusted-input hazards from `JSON.parse`.** Not exploitable. Verified by
  feeding `{"runs":[{"results":[{"__proto__":{"polluted":"yes"},...}]}],"__proto__":{"pwned":"yes"}}`
  through the real transform: `Object.prototype.pwned === undefined`, `Object.prototype.polluted ===
  undefined`. `JSON.parse` creates an own `__proto__` property rather than setting the prototype, and
  the transform only performs direct own-property assignment -- no merge, no spread-into-shared-object,
  no `eval`, no shell, no path interpolation. Malformed input (`locations: "x"`, non-iterable `results`)
  throws, which under GitHub Actions' `bash -e` fails the step loudly -- the correct posture, and
  identical to the code it replaces.
- **The `located` predicate on every shape fallow emits.** `locations` absent, `locations: null`,
  `locations: []`, `[{}]`, `[{physicalLocation:{}}]`, and `uri: ''` all correctly classify as deficient
  (empty-string uri caught by the explicit `.length > 0` -- easy to miss, good catch by the executor).
- **Does the spec guard the bug?** Yes, non-vacuously. Reverting the location fallback fails
  assertion 1 (run 1's chain short-circuits to `undefined`, not `.fallowrc.jsonc`) and assertion 3 (run
  1 undefined, run 2 TypeError). `validateSarif` is correctly demoted to an envelope guard with an
  explicit comment that it CANNOT detect this bug -- and its `expect(valid, errors)` form matches
  `validateSarif`'s `errors: string` signature and the established call sites.
- **Fixture fidelity.** Run 1 matches research Finding 3's verbatim capture: `fallow/code-duplication`,
  `level: warning`, the exact `Clone group 1 (44 lines, 2 instances)` message, `locations` OMITTED (not
  `[]`), no `tool.driver.rules`, no `partialFingerprints`, `automationDetails.id: 'fallow/audit/dupes'`
  -- alongside a properly-located sibling run.
- **Subprocess pattern.** Matches `merge-sarif.spec.ts` exactly (`execFileSync` + `mkdtempSync` +
  `rmSync` in `finally`, imports limited to node builtins + vitest + `@workspace/test-util`), and
  `nx lint` at `maxWarnings: 0` passes -- proving the `@nx/enforce-module-boundaries` claim in the
  spec header is real, not folklore. `createFixture()` as a factory rather than a shared const is the
  right call for the deep-equal in assertion 2.
- **Conventions.** ASCII-only in all three files (0 bytes > 127); `singleQuote`; braces on every
  control-flow body; blank lines before the inner `for`, before the `if`, and before `return doc`;
  comments explain WHY throughout; Prettier clean; no debug artifacts, no TODO/FIXME, no dead code,
  no commented-out code, no magic numbers.
- **Comment reconciliations.** `ci.yml:759-771` correctly restates the red-proof inline style
  constraint self-containedly and no longer cross-references the deleted fallow rewrite; its claim
  that the one-liner needs no location fallback is TRUE (the shipped reporter always emits a
  `fileUri`, `sarif-report.ts:216-219`). The load-bearing "literal here MUST equal the TOOL constant
  in tools/ci/assert-code-scanning.mjs" sentence survived the re-flow intact.
- **`.fallowrc.jsonc` as the anchor.** Tracked at the repo root, and `duplicates.ignore` really is
  there (`.fallowrc.jsonc:311-312`) -- so the "the file a maintainer edits to act on a clone group"
  rationale is factually correct, not just plausible.

## Fact-check results (header comment)

| Claim | Verdict |
| --- | --- |
| CI runs `30004691193` / `29772473095` fired this bug | **TRUE** -- both exist; `Upload fallow SARIF` conclusion `failure` in jobs `89197848941` / `88453796187` |
| "zero fallow analyses exist at those commits" | **TRUE** -- neither `e1d25ce9...` nor `8634c368...` appears among the 49 distinct commits with a fallow analysis |
| ATC90002 region-less precedent back-fills to line 1 col 1 | **TRUE** -- live alert: `tools/sarif-proof-fixture/tsconfig.json`, `start_line/start_column/end_line/end_column` all `1` |
| "all 98 existing analyses report category `fallow`" | **TRUE** today; see SG-02 (undated snapshot) |
| "mirrors the shipped reporter's own file-less fallback" | **HALF-TRUE** -- see IM-02 (anchor mirrored, fingerprint not) |
| `fallow config-schema` exposes no sarif/location/anchor knob | **TRUE** -- 88283 bytes scanned; all 10 hits are unrelated prose (email hashing, plugin dirs, regex anchoring) |
| fallow 3.9.1 reproduces identically | **NOT INDEPENDENTLY RE-VERIFIED** -- reproducing it requires manufacturing a clone group in the working tree, which a read-only review will not do. RESEARCH Finding 7 records it as PROVEN with the exact command and captured output. Accepted as-is; noted only so nobody later mistakes it for reviewer-confirmed. (Corroborated indirectly: a real `fallow audit --format sarif --base origin/main~120` run during this review produced 2 runs / 0 findings -- exactly RESEARCH Pitfall 4's "the bug is invisible on a clean tree".) |
| Dotfile `artifactLocation.uri` acceptance + end-to-end upload | REAL-CI-ONLY, deliberately unproven -- correctly flagged as such in the header, the SUMMARY, and the PLAN. `FALLBACK_URI` is a single named constant, so the swap is genuinely cheap (see SG-05b). No comment overstates it as proven. |

---

_Reviewed: 2026-07-25_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
