import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    // D-11: lock the framework-agnostic core boundary at lint time. core/**
    // must never import the Nx/Angular CLI families or a CLI arg parser
    // (including type-only imports -- allowTypeImports is OMITTED so they are
    // also banned, verified default in @typescript-eslint@8.62.0), and must
    // stay pure (no console, no process.exit -- the adapter owns I/O + exit).
    // @nx/enforce-module-boundaries is project/tag-granular and cannot ban a
    // folder within one project, so a specifier ban is the right tool.
    // Scoped to **/src/core/**/*.ts ONLY so the future Phase-4 adapter (which
    // legitimately imports @nx/devkit) is not hit. Leaves the existing
    // @nx/dependency-checks + @nx/nx-plugin-checks blocks untouched (D-12).
    files: ['**/src/core/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'nx',
              message:
                'core/ is framework-agnostic: no Nx CLI/devkit imports (D-11).',
            },
            {
              name: '@nx/devkit',
              message: 'core/ must not import @nx/devkit (D-11).',
            },
            {
              name: '@angular-devkit/architect',
              message:
                'core/ must not import the Angular CLI architect (D-11).',
            },
            {
              name: 'yargs',
              message: 'core/ must not import a CLI arg parser (D-11).',
            },
          ],
          patterns: [
            {
              group: ['@nx/*'],
              message: 'core/ must not import any @nx/* package (D-11).',
            },
            {
              group: ['@angular-devkit/*'],
              message:
                'core/ must not import any @angular-devkit/* package (D-11).',
            },
          ],
        },
      ],
      'no-console': 'error',
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'exit',
          message:
            'core/ must not call process.exit (D-11); the adapter owns exit.',
        },
      ],
    },
  },
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          // D-06: stop the autofix rewriting the PUBLIC peer ranges to the
          // installed exact versions (`^22.0.0` -> `22.0.4`). The rule still
          // catches MISSING/OBSOLETE deps; only the version-mismatch autofix is
          // disabled. NEVER run `eslint --fix` blindly on the manifest.
          checkVersionMismatches: false,
          // ACP-01 (D-07/D-08): @angular-devkit/architect + rxjs are the
          // runtime peers of the converted `angular-typechecker:typecheck`
          // builder. Their `require()`s live INSIDE @nx/devkit's
          // convertNxExecutor bridge, so this plugin's own src/ never imports
          // them -- without this ignore the rule would flag both declared
          // (optional) peers as obsoleteDependency and fail `nx lint`
          // (maxWarnings:0). `peerDependenciesMeta.optional` does NOT exempt a
          // peer from the obsolete check; ignoredDependencies is the lever.
          // `nx` is likewise ignored: v0.2.1 declares it as a DIRECT `^23.0.0`
          // dependency (so yarn / any non-peer-auto-installing consumer gets it
          // -- @nx/devkit's entrypoint require()s `nx/src/devkit-exports` at
          // load), but this plugin's own `src/` never imports `nx` (it is a
          // runtime-transitive requirement satisfied via @nx/devkit). Without
          // this ignore @nx/dependency-checks would flag `nx` obsoleteDependency
          // and fail `nx lint` at maxWarnings:0. See
          // .planning/debug/cli-yarn-e2e-wrong-version.md. An `ng add` into a
          // non-Nx Angular CLI workspace may still materialize a `.nx/` cache
          // dir; the README `## Angular CLI` prose covers it (ACD-01).
          // `@angular-devkit/schematics` is likewise ignored (24-06): the vanilla
          // nx-free ng-add schematic TYPE-imports Rule/Tree/SchematicContext from
          // it (erased at compile -- the compiled schematic.js requires only the
          // pure core), and it is an Angular-CLI-provided peer, so without this
          // ignore the rule would flag it MISSING and fail `nx lint` at
          // maxWarnings:0.
          ignoredDependencies: [
            'nx',
            '@angular-devkit/architect',
            '@angular-devkit/schematics',
            'rxjs',
          ],
          ignoredFiles: [
            '{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}',
            '{projectRoot}/vitest.config.{js,ts,mjs,mts}',
            '{projectRoot}/vitest.integration.config.{js,ts,mjs,mts}',
          ],
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
  {
    files: ['**/package.json'],
    rules: {
      '@nx/nx-plugin-checks': 'error',
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
];
