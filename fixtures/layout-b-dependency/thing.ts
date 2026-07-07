// A transitively-imported DEPENDENCY source: imported by the aggregated
// `card.component.ts` but NOT matched by the host's widened `.storybook` include
// and NOT under the host base dir. Under input-set membership it is neither a
// rootName nor under `base` nor `node_modules` -- a genuine dependency `.ts` that
// must be SUPPRESSED (content isolation). Its INTERNAL error's CODE must be ABSENT
// from the reported diagnostics, while the suppression still increments
// `suppressedInGraphErrorCount` so the verdict is coverage-incomplete, not a false
// PASS (criterion 3, R1; threat T-17-15).
export function makeTitle(): string {
  const box = { value: 'card' };

  // TS2339: Property 'missing' does not exist on type '{ value: string; }'. A
  // DISTINCT code from the story's TS2322, so the isolation spec can assert this
  // exact code is absent from the reported set.
  return box.missing;
}
