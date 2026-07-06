import type { StorybookConfig } from '@storybook/angular';

// Composing Storybook HOST (Composition topology, plan 19-02). The `refs` object
// declares the composed Storybooks and is type-checked as ORDINARY TypeScript on
// this host's OWN typecheck target: a mistyped entry (e.g. a numeric `url`) is a
// plain TS error on this file. The Nx graph edge (implicitDependencies in
// project.json), NOT the ref URL, is the source of truth for coverage --
// `dependsOn: ["^typecheck"]` fans the check out over the composed set. `refs` is
// typed via StorybookConfig['refs'] so the config needs no other required fields;
// the committed baseline is CLEAN.
//
// The lib-buttons localhost `url` value below is the CLEAN ANCHOR the e2e rewrites
// at runtime to a numeric `url` (an ordinary TS error). Keep it intact and keep the
// literal string unique in this file so the spec's first-match replace hits it.
const refs: StorybookConfig['refs'] = {
  'lib-buttons': { title: 'Buttons', url: 'http://localhost:7008' },
  'lib-cards': { title: 'Cards', url: 'http://localhost:7009' },
};

export default { refs };
