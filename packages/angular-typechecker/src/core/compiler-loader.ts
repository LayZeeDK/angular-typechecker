import type * as ng from '@angular/compiler-cli';

let cached: typeof ng | undefined;

/**
 * Lazily loads the ESM-only @angular/compiler-cli from a CommonJS module and
 * memoizes the resolved namespace. The dynamic load below is the single runtime
 * value-import of @angular/compiler-cli in the whole package (every other module
 * uses `import type`); it is the GATE A runtime path (ENG-03) and must survive
 * @nx/js:tsc emit as a native dynamic load (compiled under module: nodenext).
 */
export async function loadCompilerCli(): Promise<typeof ng> {
  cached ??= await import('@angular/compiler-cli');

  return cached;
}
