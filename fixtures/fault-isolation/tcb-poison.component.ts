import { Component, input } from '@angular/core';

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
// HOW THIS TRIGGERS IMPORT_GENERATION_FAILURE -- this is the EXACT construct from
// Angular's own v22.0.4 test suite (compiler-cli/test/ngtsc/template_typecheck_spec.ts:86-115,
// "should not fail with a runtime error when generating TCB"): a referenced
// component `SubComponent` is INTENTIONALLY NOT EXPORTED, has a required input,
// and is bound in this component's template. Under strictTemplates the type-check
// block (TCB) must reference SubComponent's class to type-check the [someInput]
// binding. Because SubComponent is not exported from its module, the reference
// emitter cannot generate an import for it into the separate .ngtypecheck shim
// (ReferenceEmitKind.Failed -> unexportedDiagnostic, tcb_adapter.ts:377), so
// referenceTcbValue throws FatalDiagnosticError(IMPORT_GENERATION_FAILURE)
// ("Unable to import symbol SubComponent.", reference_emit_environment.ts:52)
// DURING TCB GENERATION.

// Deliberately NOT exported: the referenced component that poisons the TCB. Its
// bound input forces the TCB to reference this (unexported) class.
@Component({
  selector: 'sub-cmp',
  standalone: true,
  template: '',
})
class SubComponent {
  someInput = input.required<string>();
}

@Component({
  selector: 'tcb-poison',
  standalone: true,
  imports: [SubComponent],
  templateUrl: './tcb-poison.component.html',
})
export class TcbPoisonComponent {}
