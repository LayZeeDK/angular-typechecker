import type { StorybookConfig } from '@storybook/angular';

// Generator-shaped Storybook entry (SB-06 criterion 1, Layout A). Importing
// @storybook/angular pulls the FORCED-SB10 type surface (and its transitive .d.ts)
// into this leaf's checked program; with skipLibCheck:false in
// ./.storybook/tsconfig.json, SB10's TS6 .d.ts errors fire and are then
// node_modules-suppressed by the boundary keep-rule -- the CLEAN BASELINE exit 0
// proves they never leak in-project (the implicit T5 Storybook proof). Typed
// Partial + empty object so THIS file carries zero in-project type error regardless
// of SB10's exact StorybookConfig required-field shape.
const config: Partial<StorybookConfig> = {};

export default config;
