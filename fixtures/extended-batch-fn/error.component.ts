import { Component } from '@angular/core';

// Batch C -- the event / track-function / @let-family extended diagnostics (D-03
// batch fixtures per program). OUT OF the project graph; kept out of the plugin
// build by tsconfig.lib.json's include: ["src/**/*.ts"] scope. Do NOT add
// @ts-nocheck -- the diagnostics ARE the fixture input.
//
// This ONE program's template (error.component.html) triggers exactly THREE
// extended diagnostics, each EXACTLY ONCE, all WARNING by default. They are
// independent (an event binding, a `@for` track expression, and a `@let`
// declaration) with no cross-interference (CAT-01 exact-count):
//
//   NG8111 UNINVOKED_FUNCTION_IN_EVENT_BINDING  `(click)="handleClick"`
//     -- a function referenced but not invoked in an event binding.
//   NG8115 UNINVOKED_TRACK_FUNCTION             `@for (... ; track trackByName)`
//     -- the `@for` track function is referenced but not invoked.
//   NG8112 UNUSED_LET_DECLARATION               `@let notUsed = 2;`
//     -- a `@let` declaration that is never read.
//
// Every referenced member is valid and correctly typed so no incidental TS or
// extra NG diagnostic pollutes the counts (RESEARCH Pitfall 4). These THREE are
// the ONLY diagnostics.
@Component({
  selector: 'extended-batch-fn',
  standalone: true,
  templateUrl: './error.component.html',
})
export class ExtendedBatchFnComponent {
  items = [{ id: 1 }, { id: 2 }];

  // NG8111: referenced-but-not-invoked in an event binding.
  handleClick(): void {
    // no-op
  }

  // NG8115: referenced-but-not-invoked as a `@for` track function.
  trackByName(item: { id: number }): number {
    return item.id;
  }
}
