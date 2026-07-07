# Vite/Analog Storybook query-import support

Blueprint for handling Vite-specific import query suffixes (`?raw`, `?url`, `?worker`, `?inline`,
virtual modules) that report `TS2307` under angular-typechecker's full ngc check. Synthesized from
spikes 009 (the fix) + 010 (the optional advisory). The tool is builder-agnostic; this is a
consumer-tsconfig configuration concern, not a tool defect.

## Requirements

- **Never auto-suppress `TS2307`.** A missing module can be a real bug (never-a-silent-false-pass
  charter). The resolution is consumer-side configuration or an ADVISORY, never a filter that drops
  the diagnostic.
- The story file is a declared rootName -> in-project -> its `TS2307` is correctly KEPT by
  `filter-diagnostics.ts` (input-set membership). Do not special-case it.
- Any advisory must be verdict-neutral (like `notTypeCheckedDeclaredFiles` for `.mdx`/JSX) and must
  key on PUBLIC diagnostic fields only (no ngtsc internals, no Storybook/framework coupling).

## How to Build It

### 1. Documentation recipe (ship this -- highest value, zero engine change) [spike 009]

The fix a consumer applies to the CHECKED tsconfig:

```jsonc
// the tsconfig angular-typechecker is pointed at (e.g. .storybook/tsconfig.json or the solution)
{
  "compilerOptions": { "types": ["vite/client"] }
}
```

`vite/client` (present in any Vite/Analog Storybook, e.g. via `@analogjs/storybook-angular`) declares
the full query family as wildcard ambient modules: `*?raw`, `*?url`, `*?inline`, `*?no-inline`,
`*?worker`, `*?worker&inline`, `*?worker&url`, `*?sharedworker[&*]`, `*?url&inline`. One line.

Fallback when `vite` is not resolvable -- a hand ambient shim in a `.d.ts` included by the tsconfig:

```ts
declare module '*?raw' { const src: string; export default src; }
declare module '*?url' { const src: string; export default src; }
declare module '*?worker' { const w: { new (): Worker }; export default w; }
// ...enumerate every suffix you use; INCOMPLETE by construction -- prefer vite/client
```

Proven: `"types": ["vite/client"]` drove radix-ng's Vite `?query` `TS2307` from **227 -> 0** (and a
hermetic fixture 5 -> 0). The plain missing-module `TS2307` and value-type misuse (`TS2322`) both
survive -- no-false-pass preserved.

### 2. Detection advisory (OPTIONAL later DX) [spike 010]

If implemented, add a NEW verdict-neutral advisory beside `notTypeCheckedDeclaredFiles`. Detector
(pure, over the final diagnostic set):

```
for each diagnostic where code === 2307:
  spec = /Cannot find module '([^']+)'/.exec(flattenDiagnosticMessageText(d.messageText, '\n'))[1]
  if spec.includes('?'):  # a '?' in a module specifier = bundler query; TS/Node never use '?'
    flag spec
if any flagged: emit advisory "N unresolved imports use a bundler query suffix ... add
  \"types\": [\"vite/client\"] ... ADVISORY: the TS2307 are NOT suppressed."
```

Self-gating: it keys on the PRESENCE of the unresolved `?query` `TS2307`, so it falls silent
automatically once the consumer adds the shim. Deterministic; no false positive on a plain missing
module (no `?`); never suppresses.

## What to Avoid

- **Do NOT auto-suppress `?query` TS2307** -- masks genuine missing modules. Rejected.
- **Do NOT detect via the Storybook framework** (`.storybook/main.ts` `framework`, package.json) --
  couples to Storybook, violates the no-Storybook-machinery charter, and is unnecessary; the
  diagnostic-specifier signal is builder-agnostic.
- **A hand `declare module` shim is incomplete** -- it only covers suffixes you enumerate (the
  hermetic test missed `?inline`). Prefer `vite/client`.

## Constraints

- **Wildcard blind spot:** an ambient wildcard (`*?raw`) matches the SPECIFIER, not the file -- so a
  `?query` import of a NONEXISTENT base file resolves and will NOT error. TS cannot verify base
  existence through an ambient wildcard (same as Vite's own build-vs-typecheck split). Narrow: only
  affects `?query`-suffixed imports of a missing base.
- `vite/client` requires `vite` resolvable in the checked project (true for Vite/Analog Storybook).
- Versions proven: vite 8.1.0, @angular/compiler-cli 22.0.4 (+ off-stack Angular 20/21 via radix),
  typescript 6.0.3.

## Origin

Synthesized from spikes: 009 (vite-ambient-shim-resolves-query-imports, VALIDATED),
010 (vite-query-detection-advisory, VALIDATED).
Source records in-repo: `.planning/spikes/009-vite-ambient-shim-resolves-query-imports/`,
`.planning/spikes/010-vite-query-detection-advisory/` (README + harness.mjs + forensic-log.json +
fixture). Real-repo acceptance: radix-ng/primitives 227 `?query` TS2307 -> 0.
