import { Component } from '@angular/core';

// RES-01 spike probe input (NON-TEMPLATE / analysis-phase diagnostic). OUT OF the
// project graph: nothing in the workspace imports it, and it is kept out of the
// plugin build by tsconfig.lib.json's include: ["src/**/*.ts"] scope (the
// fixtures live at the workspace root, not under the package). Do NOT add
// @ts-nocheck -- the error IS the probe input.
//
// This component imports a PLAIN class (not a @Component / @Directive / @Pipe) in
// its standalone `imports:` array. The Angular compiler raises an ANALYSIS-phase
// diagnostic (NG2008-class "is not a known component / pipe / standalone") during
// traitCompiler analysis -- this lands in getNonTemplateDiagnostics()
// (traitCompiler.diagnostics, compiler.ts:1243-1258), NOT the per-file template
// path. The RES-01 probe inspects this diagnostic's .file to test whether a
// non-template diagnostic is file-bearing-and-matched (the SIMPLE precondition).

// A plain, non-Angular class -- not a valid standalone import.
class NotAComponent {}

@Component({
  selector: 'non-template-error',
  standalone: true,
  imports: [NotAComponent],
  template: '<p>non-template error</p>',
})
export class NonTemplateErrorComponent {}
