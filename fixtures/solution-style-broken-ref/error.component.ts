import { Component } from '@angular/core';

// Broken-reference fixture SURVIVOR leaf (Phase 13, D-05 fold-and-count
// substrate). The solution tsconfig references this real leaf PLUS a nonexistent
// ./tsconfig.missing.json path. D-05 (B3) synthesizes ONE counted 90002 Error for
// the missing path and STILL walks this survivor, so this planted TS2322 must
// also be reported alongside the 90002 (deterministic non-zero verdict, no false
// PASS by omission). Plain TS error, literal template (no NG8xxx co-fire). OUT OF
// the project graph. Do NOT add @ts-nocheck.
@Component({
  selector: 'solution-style-broken-ref-leaf',
  standalone: true,
  template: '<p>survivor</p>',
})
export class BrokenRefLeafComponent {
  // Planted TS2322: string assigned to number. Proves the survivor leaf was
  // walked even though a sibling reference path does not exist.
  count: number = 'broken-ref-not-a-number';
}
