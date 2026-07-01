// TEST-03 matrix fixture: publishable-lib public entry. ng-package.json references
// this as `entryFile`, but the `build` target (@nx/angular:package) is a
// STRUCTURAL marker only -- Nx never resolves it when running typecheck
// (OQ-1), so this barrel exists purely so the publishable shape is complete.
export { PublishableLibComponent } from './publishable-lib.component';
