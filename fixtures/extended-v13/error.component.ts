import { Component } from '@angular/core';

// F5 -- extended diagnostic introduced in v13 (NG8101 = INVALID_BANANA_IN_BOX,
// "invalidBananaInBox"). OUT OF the project graph; kept out of the plugin build
// by tsconfig.lib.json's include: ["src/**/*.ts"] scope (the fixtures live at
// the workspace root, not under the package). Do NOT add @ts-nocheck -- the
// diagnostic IS the fixture input.
//
// NG8101 is an EXTENDED template diagnostic (verified = 8101 in installed
// @angular/compiler-cli@22.0.4 error_code.d.ts:394; on the extended path per
// extended_template_diagnostic_name.d.ts -> "invalidBananaInBox"). It is a
// WARNING by default (no `extendedDiagnostics.defaultCategory` override here), so
// it lands in warningCount, NOT errorCount. The fixtures/extended-promoted twin
// sets defaultCategory: "error" to prove the SAME code auto-promotes to Error.
//
// Trigger (verified against the bundled InvalidBananaInBoxCheck): a BoundEvent
// whose name is wrapped in brackets, i.e. the inverted box `([prop])="expr"`
// (parentheses OUTSIDE, brackets INSIDE) instead of the correct `[(prop)]`. Both
// `value` and `update` are valid class members so NG8101 is the ONLY diagnostic
// (no incidental TS error).
@Component({
  selector: 'extended-v13',
  standalone: true,
  templateUrl: './error.component.html',
})
export class ExtendedV13Component {
  value = '';
  update = '';
}
