# Initial (feature-scoped) prior-art pass -- SUPERSEDED for v0.0.3

These four files were the FIRST research pass, written before the v0.0.3 scope was
clarified. They are framed around the DEFERRED feature families (INF/GEN/SUR/REP/SUP) --
incremental/`--watch`, reporters, standalone CLI, Storybook, etc.

**v0.0.3 scope is improving the EXISTING engine, NOT shipping deferred features.** So the
"learnings for deferred features" in these files are OUT OF SCOPE for this milestone.

They are retained because their factual research (Angular Language Service `ngtsc` internals,
Prettier vendoring discipline, Oxc positioning, AnalogJS fastCompile + Brandon Roberts'
bottleneck numbers) is accurate and reusable. The engine-relevant facts were carried forward
into the engine-improvement files one level up:

- `../ENGINE-REFERENCE.md` -- `@angular/build` gatherer vs ours (the core improvement axis)
- `../CONSUMER-GATHERERS.md` -- AnalogJS + `@nx/js` gatherer comparison
- `../SHIM-HARDENING.md` -- `compiler-cli-types.ts` drift hardening (extends the Prettier idioms)
- `../COMPILER-CLI-INTERNALS.md` -- `@angular/compiler-cli`/`@angular/compiler` internals
- `../PRIOR-ART-SUMMARY.md` -- the authoritative engine-improvement synthesis

Files here: `LANGUAGE-SERVICE.md`, `PRETTIER-PARSERS.md`, `OXC-COMPILER.md`, `ANALOG-FASTCOMPILE.md`.
