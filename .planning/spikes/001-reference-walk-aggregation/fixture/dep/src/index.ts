// Non-buildable local dep, resolved to SOURCE via the `@spike/dep` paths alias
// in tsconfig.base.json. Clean in spike 001 (the aggregation proof is about the
// lib+spec overlap, not the dep). Spikes 002/003 reuse this shape to exercise the
// boundary guard and the double-compile cost.
export function depLabel(): string {
  return 'dep';
}
