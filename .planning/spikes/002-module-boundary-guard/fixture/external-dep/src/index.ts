// OUT-OF-PROJECT path-mapped dep (`@ext/dep`), source OUTSIDE the project dir
// (sibling of project/). It is IMPORTED by the in-project consumer, so its source
// is pulled into the leaf Program. Its deliberate TS2322 must be SUPPRESSED by
// default (includeDeps=false) and KEPT when includeDeps=true -- i.e. governed by
// the EXISTING diagnostic boundary filter, UNCHANGED by the reference-walk.
export const extDepValue: number = 'EXTERNAL DEP ERROR'; // TS2322 (Error)
