import { AppComponent } from './app.component';

// Clean SECOND leaf (spec tsconfig) for the standalone-CLI fixture. Kept
// test-runner-dependency-free (no jasmine/vitest globals) so it type-checks with
// ONLY the Angular 22 peer set -- the shipped bin can check it as a distinct leaf
// (a two-path union / spec cell). Committed clean; errors are PLANTED at runtime.
export const checkedComponent: typeof AppComponent = AppComponent;
