import type { Meta, StoryObj } from '@storybook/angular';

import { BadComponent } from './bad.component';

// A story aggregating the broken component -- proves NG8xxx fire on a component
// reachable through the forced-SB10 story surface (G4).
const meta: Meta<BadComponent> = {
  title: 'Bad',
  component: BadComponent,
};
export default meta;

export const Primary: StoryObj<BadComponent> = {};
