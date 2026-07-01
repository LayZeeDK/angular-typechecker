import { SolutionStyleLeafComponent } from './error.component';

// Solution-style fixture SPEC-LEAF source (Phase 13, D-03a walk substrate). This
// is the target of `tsconfig.spec.json`'s reference and is reachable ONLY through
// the spec leaf: a build never compiles specs, but the reference-walk's spec leaf
// does. That makes this file the NAMED build differentiator -- its planted error
// can only appear if the walk actually type-checked the spec tsconfig.
//
// It plants a DISTINCT plain TS2322 (a different string, in a different file) so
// its identity (file.path + start + length + code + messageText) cannot collapse
// with the app leaf's TS2322 under ts.sortAndDeduplicateDiagnostics -- the union
// then unambiguously reports BOTH leaves' errors. Plain TS error only; no
// interpolated signal. OUT OF the project graph. Do NOT add @ts-nocheck.
const specOnly: number = 'also-not-a-number';
void specOnly;
void SolutionStyleLeafComponent;
