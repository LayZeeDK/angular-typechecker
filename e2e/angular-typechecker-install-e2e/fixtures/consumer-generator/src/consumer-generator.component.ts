import { Component } from '@angular/core';

// Phase 15 GE2E fixture: the template-bearing source of the LIB LEAF of the
// un-wired multi-leaf consumer-generator workspace (D-01). A self-contained
// standalone component WITH a template so the generator-wired typecheck target
// exercises Angular template type-check on the walked lib leaf. It is a rootName in
// the lib leaf's program (tsconfig.lib.json) AND is imported by the *.spec.ts, so
// it is ALSO compiled in the spec leaf. Committed CLEAN and left clean: because it
// is compiled by BOTH leaves, a diagnostic here could NOT uniquely attribute to the
// lib leaf -- so the generator-e2e spec injects its deliberate TS2322 into the
// lib-ONLY consumer-generator.util.ts (a file NO spec imports) instead (WR-01). Its
// solution tsconfig.json references BOTH this leaf (tsconfig.lib.json) and the spec
// leaf (tsconfig.spec.json).
@Component({
  selector: 'consumer-generator-root',
  standalone: true,
  template: '<p>{{ label }}</p>',
})
export class ConsumerGeneratorComponent {
  readonly label: string = 'angular-typechecker generator e2e';
}
