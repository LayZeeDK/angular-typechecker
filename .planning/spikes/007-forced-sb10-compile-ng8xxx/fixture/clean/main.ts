import type { StorybookConfig } from '@storybook/angular';

// G3 probe: forces TS to resolve @storybook/angular's StorybookConfig type
// surface (and transitively its storybook/internal/* + @angular/* type deps)
// under TS 6. If the forced-SB10 .d.ts fails to load or leaks an error to THIS
// in-project file, G3 fails. Type-only re-export avoids fighting the config
// value shape (not what G3 tests).
export type SbConfig = StorybookConfig;
