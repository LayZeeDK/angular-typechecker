import { Component, signal } from '@angular/core';

import { depLabel } from '@spike/dep';

// SHARED source file: a rootName of tsconfig.lib.json AND pulled into
// tsconfig.spec.json's program via the spec's `import './widget.component'`.
// It therefore produces the SAME two diagnostics in BOTH leaf programs -- the
// cross-Program duplicate that the union+dedupe must collapse to one.
//
//   - `count`  : a plain TS2322 (Error)   -- string assigned to number.
//   - template : `{{ status }}` interpolates an UN-invoked signal getter ->
//                NG8109 (Warning by default) -- proves warningCount aggregation.
@Component({
  selector: 'spike-widget',
  standalone: true,
  template: '<p>{{ status }} {{ label }}</p>',
})
export class WidgetComponent {
  readonly count: number = 'not a number'; // TS2322 (Error)
  readonly label = depLabel();
  status = signal('ready'); // interpolated un-invoked in the template -> NG8109 (Warning)
}
