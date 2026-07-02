import { Component, Directive } from '@angular/core';

// Own program -- NG8113 UNUSED_STANDALONE_IMPORTS (unusedStandaloneImports). OUT OF
// the project graph; kept out of the plugin build by tsconfig.lib.json's
// include: ["src/**/*.ts"] scope. Do NOT add @ts-nocheck -- the diagnostic IS the
// fixture input.
//
// NG8113 is a WARNING by default (no extendedDiagnostics.defaultCategory override
// in tsconfig.app.json). It is one of the two OUT-OF-BAND checks (no
// `extended/checks/` factory) -- but it is a NORMAL configurable/promotable
// member (RESEARCH Promotability finding; D-09). It is a COMPONENT-METADATA check
// (not a template node): it fires when a symbol listed in a standalone
// `@Component.imports` is never referenced in that component's template.
//
// Trigger: `UnusedStandaloneDirective` is listed in `imports: [...]` but never
// used in error.component.html. The directive is a real, valid standalone
// directive so NG8113 is the ONLY diagnostic (no incidental TS error). The
// template renders only static text, referencing nothing.
@Directive({
  selector: '[appUnusedStandalone]',
  standalone: true,
})
export class UnusedStandaloneDirective {}

@Component({
  selector: 'extended-unused-standalone-imports',
  standalone: true,
  imports: [UnusedStandaloneDirective],
  templateUrl: './error.component.html',
})
export class ExtendedUnusedStandaloneImportsComponent {}
