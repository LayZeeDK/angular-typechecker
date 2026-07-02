import { Component } from '@angular/core';

// Self-reference fixture leaf (Phase 13, D-04 output-neutral dedupe substrate).
// The solution tsconfig references itself (./tsconfig.json) AND lists this leaf
// (./tsconfig.app.json) twice. D-04 canonicalizes + dedupes resolved leaf paths
// and skips the self-reference before the compile loop, so this leaf's single
// planted TS2322 must appear EXACTLY ONCE despite the duplicate + self edges
// (output-neutral: dedupe saves a redundant compile, never changes the reported
// set). Plain TS error, literal template (no NG8xxx co-fire). OUT OF the project
// graph. Do NOT add @ts-nocheck.
@Component({
  selector: 'solution-style-selfref-leaf',
  standalone: true,
  template: '<p>selfref</p>',
})
export class SelfRefLeafComponent {
  // Planted TS2322: string assigned to number. Must be reported once despite the
  // duplicate leaf reference and the self reference.
  count: number = 'selfref-not-a-number';
}
