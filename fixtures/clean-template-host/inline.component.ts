import { Component } from '@angular/core';

// D-09a(i) clean-host fixture, component 2 of 2: a CLEAN component with an INLINE
// template. Angular maps inline-template diagnostics to a synthetic
// "<component>.ts (template)" file name in the error path -- a NON-rootName name
// that the D-04a base clause keeps in-graph. Both templates here are CLEAN, so the
// run must report suppressedInGraph == 0: the host's own inline + external
// templates are classified in-graph, never a false coverage-incomplete.
@Component({
  selector: 'clean-inline',
  standalone: true,
  template: '<p>{{ label }}</p>',
})
export class InlineTemplateComponent {
  label = 'world';
}
