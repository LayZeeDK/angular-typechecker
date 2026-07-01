import { Component } from '@angular/core';

// Baseline NG3003 (IMPORT_CYCLE_DETECTED, error_code.d.ts:166; Error) -- FIRST
// component of the cyclic NgModule scope. OUT OF the project graph; kept out of
// the plugin build by tsconfig.lib.json's include: ["src/**/*.ts"] scope. Do NOT
// add @ts-nocheck -- the diagnostic IS the fixture input.
//
// This component's template USES `<app-second>` (SecondComponent's selector) but
// does NOT import SecondComponent -- the two are wired only via the shared
// NgModule (cycle.module.ts). SecondComponent symmetrically uses `<app-first>`.
// Because neither file imports the other, Angular must GENERATE cross-imports in
// both directions to compile the templates, which forms an un-handleable cyclic
// import. Under `compilationMode: "partial"` remote scoping is unavailable
// (cycle-handling strategy = Error), so the compiler surfaces NG3003
// (display-encoded as -993003). See cycle.module.ts for the wiring.
@Component({
  selector: 'app-first',
  standalone: false,
  template: '<app-second></app-second>',
})
export class FirstComponent {}
