import type { StorybookConfig } from '@storybook/angular';

// Generator-shaped Storybook HOST entry (SB-06 criterion 1, Layout B centralized
// host). Importing @storybook/angular pulls the FORCED-SB10 type surface into this
// leaf's checked program; with skipLibCheck:false in ./.storybook/tsconfig.json,
// SB10's TS6 .d.ts errors fire and are node_modules-suppressed -- the CLEAN BASELINE
// exit 0 proves they never leak in-project. The type-check surface is driven by
// ./tsconfig.json -> ./.storybook/tsconfig.json's widened `include`, NOT this
// field. Typed Partial + empty object so THIS file carries zero in-project error.
const config: Partial<StorybookConfig> = {};

export default config;
