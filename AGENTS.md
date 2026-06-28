# AGENTS.md -- angular-typechecker

Agent-agnostic instructions for any AI coding agent working in this repository.
(Claude Code loads this via the `@AGENTS.md` reference at the top of `CLAUDE.md`.)

## Conventional Commits drive the changelog and the released version

This repository releases `angular-typechecker` to npm with **`nx release`** configured
for **`version.conventionalCommits: true`** (see `nx.json` -> `release`). That means the
NEXT version number AND the generated changelog are computed **from the commit log** --
not chosen by hand. Every commit you write is release input. Follow these rules so the
release machinery behaves predictably.

### Commit message format

```
type(scope): short imperative description

optional body explaining what and why

optional footer (e.g. BREAKING CHANGE: ..., Refs: ...)
```

- `type` is required and lowercase. `scope` is optional but, when present, is rendered
  verbatim in the changelog (see the scope-hygiene rule below).
- A breaking change is marked EITHER by a `!` before the colon (`feat(core)!: ...`) OR by
  a `BREAKING CHANGE:` footer.

### How each type influences the version bump

`nx release` maps conventional-commit types to a SemVer bump. The version bump for a
release is the HIGHEST bump implied by any qualifying commit since the previous release
tag.

**IMPORTANT -- this repo is pre-1.0, so the bumps are shifted DOWN one level.** Nx 23
enables `version.adjustSemverBumpsForZeroMajorVersion` (default `true`, and this repo does
NOT override it; verified in nx 23.0.1 `config.js` and in `.planning/research/FOLLOWUP-FINDINGS.md`).
While the current version is `0.x`, every bump nx computes is lowered one step:
`major -> minor`, `minor -> patch`, `patch -> patch`. So the operative mapping right now is:

| Commit type                          | Standard (post-1.0) | EFFECT NOW (0.x, this repo) | In the changelog?                  |
| ------------------------------------ | ------------------- | --------------------------- | ---------------------------------- |
| `feat`                               | minor               | **patch** (0.0.1 -> 0.0.2)  | Yes (Features)                     |
| `fix`                                | patch               | patch (0.0.1 -> 0.0.2)      | Yes (Fixes)                        |
| `feat!` / `fix!` / `BREAKING CHANGE:`| major               | **minor** (0.0.1 -> 0.1.0)  | Yes (Breaking Changes)             |
| `perf`                               | none                | none                        | Yes (Performance) -- shown, no bump|
| `docs`, `chore`, `refactor`, `test`, `build`, `ci`, `style`, `revert` | none | none | No (hidden by default)             |

Two consequences to internalize:

- **While in 0.x, `feat` and `fix` both produce a patch bump** -- they are
  indistinguishable for the VERSION (they still land in different changelog sections).
  A breaking change is what cuts a new minor (e.g. `0.1.0`). This stays true until the
  first `1.0.0`, after which the standard column applies.
- **A release window that contains only no-bump types (`docs`/`chore`/`perf`/etc.)
  produces NO version bump** -- `nx release` reports no releasable change. Only `feat`,
  `fix`, and breaking changes move the version.

### Always confirm with a dry run

Because the 0.x adjustment surprises people, never assume the computed version. Preview it:

```
npx nx release --dry-run
```

The dry run prints BOTH the version nx will pick and the changelog it will write, sourced
from the commit log. Treat its output as the source of truth.

(The "nx release configuration norms" note in `CLAUDE.md` states the standard post-1.0
mapping `feat -> minor, fix -> patch`; the 0.x-adjusted column above is what actually
happens until `1.0.0`.)

### Only commits that touch the published project count

`nx.json` scopes releases with `release.projects: ["angular-typechecker"]`. With
`conventionalCommits`, the version of that package is derived from commits whose changes
touch the package's project graph -- commits that only touch `.planning/`, docs, or other
projects do NOT bump `angular-typechecker`. (This is why a stretch of `docs(...)` commits
under `.planning/` leaves the package version untouched.)

Attribution is decided by the FILES a commit changes, NOT by the commit message's scope
text. A `feat(anything): ...` that edits files under `packages/angular-typechecker/` WILL
count toward that package's bump; a `feat(core): ...` that only edits `.planning/` will
NOT. So the scope is cosmetic for both attribution and (post-curation) the changelog --
write accurate `type`s and put real changes in the package's files.

## Repo-specific gotchas (learned in production)

1. **When there is no releasable (`feat`/`fix`) commit, pin the version explicitly.**
   If you must cut a release in a window that contains only `docs`/`chore` commits (for
   example, a verification or maintenance release), `conventionalCommits` will compute no
   bump. Pass the target version explicitly instead of relying on derivation:
   ```
   npx nx release 0.0.2 --skip-publish
   ```
   Confirm with `--dry-run` first. Note: a LITERAL version (`0.0.2`) bypasses
   conventional-commits derivation AND the 0.x adjustment entirely -- you get exactly what
   you typed. A keyword specifier (`patch`/`minor`/`major`) instead still goes through the
   0.x shift-down, so prefer a literal version when you want a deterministic result.

2. **The auto-generated changelog renders the commit SCOPE -- keep scopes clean for
   public releases.** Internal workflow scopes (for example GSD plan ids like
   `feat(05-01):` or `fix(04-03):`) leak straight into the generated CHANGELOG and the
   GitHub Release notes, and decision refs such as `[#1]` can be mis-parsed as issue
   links. For any PUBLIC release, hand-curate a clean `CHANGELOG.md` entry (match the
   existing `0.0.1` entry's style) rather than shipping the raw generated dump. Prefer
   release-meaningful scopes (`core`, `executor`, `release`, `deps`) over internal ids in
   commits that will reach a public changelog.

3. **Provenance and the GitHub Release are part of the release.** `nx release` cuts the
   version commit, the changelog, and the git tag (`angular-typechecker@{version}`); the
   tag push fires `.github/workflows/release.yml`, which publishes to npm via OIDC with
   provenance and creates the GitHub Release. Do not push release tags by hand outside
   this flow.

## Quick checklist before cutting a release

1. Are the changes since the last tag committed as `feat`/`fix` (so they bump + appear in
   the changelog), or is this an explicit-version maintenance release?
2. Run `npx nx release --dry-run` and read the proposed version + changelog.
3. If only `docs`/`chore` commits exist, pin the version explicitly.
4. Curate `CHANGELOG.md` so no internal scopes/ids leak into the public changelog.
5. Cut locally with `--skip-publish`, then push the tag to let CI publish (OIDC +
   provenance). See `CLAUDE.md` (Technology Stack -> nx release configuration norms) and
   `.github/workflows/release.yml` for the full release mechanics.
