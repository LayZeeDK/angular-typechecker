import { Component } from '@angular/core';

// Baseline NG8004 (MISSING_PIPE, error_code.d.ts:250; Error). OUT OF the
// project graph; kept out of the plugin build by tsconfig.lib.json's
// include: ["src/**/*.ts"] scope. Do NOT add @ts-nocheck -- the diagnostic IS
// the fixture input.
//
// Trigger: a template uses a pipe (`nonexistentPipe`) that is neither built in
// nor declared/imported by this standalone component. The compiler cannot
// resolve the pipe, so it surfaces NG8004 (display-encoded as -998004).
@Component({
  selector: 'ng-baseline-extra-missing-pipe',
  standalone: true,
  template: '<p>{{ value | nonexistentPipe }}</p>',
})
export class MissingPipeComponent {
  value = 'x';
}
