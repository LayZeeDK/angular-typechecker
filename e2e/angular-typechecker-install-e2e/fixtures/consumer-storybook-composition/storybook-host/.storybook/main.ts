import type { StorybookConfig } from '@storybook/angular';

// Composing Storybook HOST (Composition topology, plan 19-02). The `refs` object
// declares the composed Storybooks and is type-checked as ORDINARY TypeScript on
// this host's OWN typecheck target. The Nx graph edge (implicitDependencies in
// project.json), NOT the ref URL, is the source of truth for coverage --
// `dependsOn: ["^typecheck"]` fans the check out over the composed set.
//
// Storybook types `StorybookConfig['refs']` as `any` (verified against
// @storybook/angular@10.4.6), so a bare refs object carries NO type safety. A
// realistic consumer that wants the host config type-checked declares the ref shape
// explicitly, exactly as below. angular-typechecker then type-checks this main.ts as
// ordinary TypeScript: a mistyped entry (a numeric `url`) is a plain TS error on THIS
// file. `config` is typed `Partial<StorybookConfig>` so it needs no other required
// fields and still pulls in the forced-SB10 type surface; the committed baseline is
// CLEAN.
//
// The lib-buttons localhost `url` value below is the CLEAN ANCHOR the e2e rewrites at
// runtime to a numeric `url`. Keep it intact and keep the literal string unique in
// this file so the spec's first-match replace hits it.
interface CompositionRef {
  title: string;
  url: string;
}

const refs: Record<string, CompositionRef> = {
  'lib-buttons': { title: 'Buttons', url: 'http://localhost:7008' },
  'lib-cards': { title: 'Cards', url: 'http://localhost:7009' },
};

const config: Partial<StorybookConfig> = { refs };

export default config;
