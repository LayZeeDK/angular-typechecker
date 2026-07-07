import type { StorybookConfig } from '@storybook/angular';

// Composed Storybook lib entry (Composition topology, plan 19-02). Mirrors
// consumer-storybook-a: importing @storybook/angular pulls the FORCED-SB10 type
// surface into this leaf's checked program; with skipLibCheck:false in
// ./tsconfig.json, SB10's TS6 .d.ts errors fire and are then node_modules-suppressed
// by the boundary keep-rule -- the CLEAN BASELINE exit 0 proves they never leak
// in-project. Typed Partial + empty object so THIS file carries zero in-project type
// error regardless of SB10's exact StorybookConfig required-field shape.
const config: Partial<StorybookConfig> = {};

export default config;
