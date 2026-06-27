import type { CompilerCli } from './compiler-cli-types';

let cached: CompilerCli | undefined;

/**
 * Lazily loads the ESM-only @angular/compiler-cli from a CommonJS module and
 * memoizes the resolved namespace. The dynamic load below is the single runtime
 * value-import of @angular/compiler-cli in the whole package (every other module
 * uses `import type`); it is the GATE A runtime path (ENG-03) and must survive
 * @nx/js:tsc emit as a native dynamic load (compiled under module: nodenext).
 *
 * The return type comes from a hand-built structural namespace (compiler-cli-types)
 * because the package's barrel typings do not resolve under nodenext -- see that
 * file's header. The runtime value is the real, fully-featured module.
 */
export async function loadCompilerCli(): Promise<CompilerCli> {
  cached ??= (await import('@angular/compiler-cli')) as unknown as CompilerCli;

  return cached;
}
