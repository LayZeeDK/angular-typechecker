import { buttonLabel, ButtonMeta } from '@org/button';

// T9 (criterion 2) aggregated story. Reached out-of-host-dir via the host's
// widened `.storybook` include (a DECLARED rootName of the input set). It imports
// a sibling ONLY through the `@org/*` workspace `paths` alias declared in
// `.storybook/tsconfig.json` -- the exact Layout-B DX landmine: a naive setup that
// dropped the alias would emit a spurious TS2307 (module not found) on a workspace
// that resolves fine. Everything here is well-typed, so the aliased import must
// compile clean (NO TS2307) and the verdict stays clean.
export const primary: ButtonMeta = {
  label: buttonLabel,
  order: 1,
};
