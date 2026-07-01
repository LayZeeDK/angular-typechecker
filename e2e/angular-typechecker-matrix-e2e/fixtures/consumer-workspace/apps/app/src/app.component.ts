import { Component } from '@angular/core';

// TEST-03 matrix fixture: the APPLICATION project type (D-07). A SELF-CONTAINED
// standalone component -- no workspace path-alias to plugin source, no workspace
// tsconfig.base.json extension. It is type-checked from the INSTALLED tarball via
// the PUBLISHED executor id angular-typechecker:typecheck (project.json),
// so a green run proves resolution FROM node_modules. Committed clean (no type
// error); the matrix spec injects a deliberate TS2322 into a per-run TMP copy of
// this file to prove the packaged check actually runs for the app type.
@Component({
  selector: 'app-root',
  standalone: true,
  template: '<p>{{ label }}</p>',
})
export class AppComponent {
  readonly label: string = 'angular-typechecker matrix app';
}
