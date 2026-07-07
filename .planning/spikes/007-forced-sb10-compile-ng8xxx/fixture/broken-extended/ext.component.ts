import { Component } from '@angular/core';

// G4-extended: `label` is a non-nullable string, so `label ?? 'fallback'` in the
// template triggers the extended diagnostic nullishCoalescingNotNullable
// (NG810x). The leaf tsconfig sets extendedDiagnostics.defaultCategory: "error",
// promoting the default-Warning to an ERROR so the fixture goes RED. Inline
// template => attributes to this component .ts (in-project).
@Component({
  selector: 'ext-cmp',
  template: '<span>{{ label ?? "fallback" }}</span>',
})
export class ExtComponent {
  label = 'hi';
}
