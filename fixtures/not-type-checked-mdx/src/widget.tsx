// T11 GREEN fixture -- a DELIBERATELY JSX-FREE `.tsx` (no JSX element syntax at all).
// The `.storybook/tsconfig.json` leaves `compilerOptions.jsx` UNSET, so a `.tsx`
// that USED JSX would emit a hard TS17004-class error and flip the verdict RED
// (18-RESEARCH Pitfall 3 / Assumption A1). Keeping it JSX-free proves the advisory
// is ORTHOGONAL to the verdict: this file is still enumerated into
// notTypeCheckedDeclaredFiles (jsx unset -> uncheckable), yet it compiles clean and
// the verdict stays green.
export const answer: number = 42;

export function double(value: number): number {
  return value * 2;
}
