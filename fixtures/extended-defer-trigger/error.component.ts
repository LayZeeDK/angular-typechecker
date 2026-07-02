import { Component } from '@angular/core';

// Own program -- NG8021 DEFER_TRIGGER_MISCONFIGURATION (deferTriggerMisconfiguration).
// OUT OF the project graph; kept out of the plugin build by tsconfig.lib.json's
// include: ["src/**/*.ts"] scope. Do NOT add @ts-nocheck -- the diagnostic IS the
// fixture input.
//
// NG8021 is a WARNING by default (no extendedDiagnostics.defaultCategory override
// in tsconfig.app.json). It is a STATIC template check (RESEARCH line 235; bundle
// line 3648-3671): it fires when an `@defer` block defines unreachable or
// redundant triggers -- e.g. `on immediate` together with any other main trigger.
//
// Trigger: `@defer (on immediate; on timer(1s))` -- `on immediate` makes the
// additional `on timer` trigger redundant. The block body references nothing that
// could produce an incidental error, so NG8021 is the ONLY diagnostic.
@Component({
  selector: 'extended-defer-trigger',
  standalone: true,
  templateUrl: './error.component.html',
})
export class ExtendedDeferTriggerComponent {}
