// TEST-03 matrix fixture: buildable-lib public entry. ng-package.json references
// this as `entryFile`, but the `build` target (@nx/angular:ng-packagr-lite) is a
// STRUCTURAL marker only -- Nx never resolves it when running angular-typecheck
// (OQ-1), so this barrel exists purely so the buildable shape is complete.
export { BuildableLibComponent } from './buildable-lib.component';
