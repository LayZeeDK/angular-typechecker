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
          ignoredFiles: [
            '{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}',
            '{projectRoot}/vitest.config.{js,ts,mjs,mts}',
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
