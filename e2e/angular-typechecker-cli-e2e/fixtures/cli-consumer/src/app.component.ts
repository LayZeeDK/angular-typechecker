import { Component } from '@angular/core';

// Standalone-CLI e2e consumer fixture (VER-04). A SELF-CONTAINED standalone
// component: no workspace path-alias to plugin source, no workspace
// tsconfig.base.json extension. It is type-checked by the INSTALLED, shipped
// `angular-typechecker` / `atc` bin (nx-free) pointed at ./tsconfig.json, so a
// clean run proves the CLI resolves @angular/compiler-cli FROM the consumer's
// node_modules, not from a dev path-alias. Committed clean (no type error); the
// specs plant a deliberate diagnostic CODE into a per-run TMP copy to prove the
// shipped bin actually runs and returns exit 1.
@Component({
  selector: 'app-root',
  standalone: true,
  template: '<p>{{ label }}</p>',
})
export class AppComponent {
  readonly label: string = 'angular-typechecker cli-consumer';
}
