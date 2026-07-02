// IN-PROJECT path-mapped dep (`@in/dep`), source under the project dir. Its
// deliberate TS2322 MUST be reported by default (includeDeps=false) because the
// file is under the project basePath -- proving local path-mapped dep sources
// stay reported by the existing filter.
export const inDepValue: number = 'IN-PROJECT DEP ERROR'; // TS2322 (Error)
