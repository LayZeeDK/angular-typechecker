import { Component } from '@angular/core';

// Phase 15 GE2E fixture: the LIB LEAF of the un-wired multi-leaf consumer-generator
// workspace (D-01). A self-contained standalone component WITH a template so the
// generator-wired typecheck target exercises Angular template type-check on the
// walked lib leaf. Committed CLEAN; the generator-e2e spec injects a deliberate
// TS2322 (a `number`-typed field assigned a string) into a per-run TMP copy of
// this file to prove the lib leaf is walked. Its solution tsconfig.json references
// BOTH this leaf (tsconfig.lib.json) and the spec leaf (tsconfig.spec.json).
@Component({
  selector: 'consumer-generator-root',
  standalone: true,
  template: '<p>{{ label }}</p>',
})
export class ConsumerGeneratorComponent {
  readonly label: string = 'angular-typechecker generator e2e';
}
