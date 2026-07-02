import { Component } from '@angular/core';

// Baseline NG3003 (IMPORT_CYCLE_DETECTED, error_code.d.ts:166; Error) -- SECOND
// component of the cyclic NgModule scope. OUT OF the project graph; kept out of
// the plugin build by tsconfig.lib.json's include: ["src/**/*.ts"] scope. Do NOT
// add @ts-nocheck -- the diagnostic IS the fixture input.
//
// This component's template USES `<app-first>` (FirstComponent's selector) but
// does NOT import FirstComponent -- the two are wired only via the shared
// NgModule (cycle.module.ts). FirstComponent symmetrically uses `<app-second>`.
// The two-way selector reference forces Angular to GENERATE cross-imports that
// form an un-handleable cyclic import; under `compilationMode: "partial"` the
// compiler cannot remote-scope it away, so it surfaces NG3003 (display-encoded as
// -993003). See cycle.module.ts for the wiring.
@Component({
  selector: 'app-second',
  standalone: false,
  template: '<app-first></app-first>',
})
export class SecondComponent {}
