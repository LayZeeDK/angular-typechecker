import { Component } from '@angular/core';

// Overlap fixture SHARED source (Phase 13, cross-Program dedupe substrate). The
// SAME file is listed in BOTH tsconfig.lib.json and tsconfig.spec.json, so the
// reference-walk compiles it in two separate Programs. It plants exactly ONE
// plain TS2322. Because ts.sortAndDeduplicateDiagnostics keys on file.path (a
// string, not the SourceFile object), the two Programs' identical diagnostic
// must COLLAPSE to ONE in the union -- that collapse is the cross-Program dedupe
// proof. The template is a plain literal (no interpolated signal) so no NG8xxx
// co-fires (Pitfall 3). OUT OF the project graph. Do NOT add @ts-nocheck.
@Component({
  selector: 'solution-style-overlap-shared',
  standalone: true,
  template: '<p>shared</p>',
})
export class SharedComponent {
  // Planted TS2322: string assigned to number. Compiled in both leaves; the
  // union must report this diagnostic exactly ONCE (dedupe collapse).
  count: number = 'shared-not-a-number';
}
