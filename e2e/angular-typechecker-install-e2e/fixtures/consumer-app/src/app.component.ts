import { Component } from '@angular/core';

// TEST-05 install-smoke consumer fixture (D-18). A SELF-CONTAINED standalone
// component: no workspace path-alias to plugin source, no workspace
// tsconfig.base.json extension. It is type-checked from the INSTALLED tarball via
// the PUBLISHED executor id angular-typechecker:typecheck (project.json),
// so a green run proves resolution FROM node_modules, not from a dev path-alias.
// Committed clean (no type error); the smoke injects a deliberate TS2322 into a
// per-run TMP copy of this file to prove the packaged check actually runs.
@Component({
  selector: 'app-root',
  standalone: true,
  template: '<p>{{ label }}</p>',
})
export class AppComponent {
  readonly label: string = 'angular-typechecker install smoke';
}
