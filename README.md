# angular-typechecker

Nx executor that runs the complete Angular compiler type-check (TypeScript + template type-check + extended NG8xxx diagnostics), no emit, decoupled from build and test.

This is the Nx-plugin monorepo for `angular-typechecker`. The published package lives at [`packages/angular-typechecker/`](packages/angular-typechecker/README.md) and is released to npm as `angular-typechecker`.

## Type-check an Angular project (single-target walk recipe)

`angular-typechecker` ships one Nx executor, `typecheck`, that runs the
Angular compiler's full diagnostic set (TypeScript checks plus Angular template
type-checking and extended `NG8xxx` diagnostics) for a project WITHOUT building it
or running its tests.

Wire ONE `typecheck` target per project and point its `tsConfig` at the
project's SOLUTION `tsconfig.json` -- the references-only config whose
`references[]` list the project's leaf tsconfigs (for example `tsconfig.lib.json`
or `tsconfig.app.json`, plus `tsconfig.spec.json`). The executor walks those
in-project referenced leaves in a single run and returns the complete,
duplicate-free diagnostic set for the whole project. You do NOT wire a separate
target per leaf, and you do NOT need to detect the project type -- the same
recipe covers applications, local (non-buildable), buildable, and publishable
libraries, and their spec tsconfigs.

`project.json`:

```json
{
  "targets": {
    "typecheck": {
      "executor": "angular-typechecker:typecheck",
      "options": {
        "tsConfig": "libs/my-lib/tsconfig.json"
      }
    }
  }
}
```

Run it:

```sh
npx nx typecheck my-lib
```

### Caching guidance (recommended `targetDefaults`)

Because a single target type-checks every leaf (including the spec leaf) in one
run, the target caches on ONE key. Configure the target's Nx `inputs` with the
`default` named input so that spec (`*.spec.ts`) sources hash into that key -- a
spec-only source edit MUST bust the cache, otherwise the cache could replay a
stale PASS on a broken spec. Do NOT use the `production` named input here: it
EXCLUDES `*.spec.ts`, so a spec-only change would not change the input hash.

Add this to `nx.json` (or per-project `project.json` target config):

```json
{
  "targetDefaults": {
    "angular-typechecker:typecheck": {
      "cache": true,
      "outputs": [],
      "inputs": ["default", "{projectRoot}/tsconfig*.json", "^default"]
    }
  }
}
```

- `default` -- the lib + spec source union, so both leaves' sources hash into the
  cache key.
- `outputs: []` -- the type-check emits nothing; it only reports diagnostics.
- `{projectRoot}/tsconfig*.json` -- the solution and leaf tsconfigs are inputs, so
  a tsconfig change re-checks.
- `^default` -- dependency sources hash in, so a change in a non-buildable
  dependency busts the cache too.

## Documentation

- Package usage (consumer docs): [`packages/angular-typechecker/README.md`](packages/angular-typechecker/README.md)
- Contributor and AI-agent working rules: [`AGENTS.md`](AGENTS.md)
- Security policy: [`SECURITY.md`](SECURITY.md)
- Release history: [`CHANGELOG.md`](CHANGELOG.md)

## License

MIT (c) Lars Gyrup Brink Nielsen. See [`LICENSE`](./LICENSE).
