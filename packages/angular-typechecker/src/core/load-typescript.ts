import type ts from 'typescript';

let cachedTypescript: typeof ts | undefined;

/**
 * Lazily loads `typescript` from a CommonJS module and memoizes the resolved
 * namespace (the CJS->ESM bridge; `import('typescript')` compiled under
 * module: nodenext). This is the single shared memo for the whole package.
 *
 * D-02 anti-leak: this MUST stay module-private to `core/` -- it is imported by
 * `run-typecheck.ts` and `render-report.ts` but must NEVER be added to
 * `src/index.ts`. The `ts` load stays inside core and is not barrel-exported.
 */
export async function loadTypescript(): Promise<typeof ts> {
  if (cachedTypescript === undefined) {
    const loaded = (await import('typescript')) as typeof ts & {
      default?: typeof ts;
    };
    cachedTypescript = loaded.default ?? loaded;
  }

  return cachedTypescript;
}
