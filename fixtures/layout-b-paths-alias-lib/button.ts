// T9 (criterion 2) sibling source. Lives OUTSIDE the host base dir and OUTSIDE
// the widened `.storybook` include, so it is NOT a declared rootName -- it is
// reached ONLY through the `@org/*` workspace `paths` alias the aggregated story
// imports. Its symbols are error-free, so its out-of-graph status contributes no
// suppression (nothing to drop) and the clean verdict is genuine.
export const buttonLabel: string = 'Primary';

export interface ButtonMeta {
  label: string;
  order: number;
}
