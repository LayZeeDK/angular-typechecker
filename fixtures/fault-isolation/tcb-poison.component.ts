import { Component, Directive } from '@angular/core';

// RES-02 fault-isolation fixture: the TCB-POISON half (component A). OUT OF the
// project graph: nothing in the workspace imports it, and it is kept out of the
// plugin build by tsconfig.lib.json's include: ["src/**/*.ts"] scope (the
// fixtures live at the workspace root, not under the package). Do NOT add
// @ts-nocheck -- the errors ARE the fixture input.
//
// PITFALL 2 / A1: the poison must be a TCB-GENERATION-phase FatalDiagnosticError
// (IMPORT_GENERATION_FAILURE), NOT an analysis-phase Fatal. An analysis Fatal
// lands in traitCompiler.diagnostics (the whole-program NON-template set) and
// would NOT exercise getDiagnosticsForFile's per-file template try/catch, so it
// would not prove per-file isolation.
//
// HOW THIS TRIGGERS IMPORT_GENERATION_FAILURE (reference_emit_environment.ts:52
// @ v22.0.4): UnexportedLocalDirective is a real, applied directive that the
// component's strict-templates type-check block (TCB) must reference. Because the
// directive class is NOT exported from this module, the reference emitter cannot
// generate an import for it into the separate .ngtypecheck shim file
// (ReferenceEmitKind.Failed -> unexportedDiagnostic, tcb_adapter.ts:377), so
// referenceTcbValue throws FatalDiagnosticError(IMPORT_GENERATION_FAILURE) DURING
// TCB GENERATION. The directive selector is applied in the template below, which
// forces the TCB to reference it (an unapplied import would be tree-shaken before
// reference emit and would not throw).

// Deliberately NOT exported: the unexported local directive that poisons the TCB.
@Directive({
  selector: '[poisonDirective]',
  standalone: true,
})
class UnexportedLocalDirective {}

@Component({
  selector: 'tcb-poison',
  standalone: true,
  imports: [UnexportedLocalDirective],
  templateUrl: './tcb-poison.component.html',
})
export class TcbPoisonComponent {}
