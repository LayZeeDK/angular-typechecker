import type { Meta, StoryObj } from '@storybook/angular';

import { ButtonComponent } from './button.component';

// A clean CSF3 story importing the REAL forced @storybook/angular@10.4.6 Meta /
// StoryObj types. G3: this must type-check clean (zero in-project diagnostics).
const meta: Meta<ButtonComponent> = {
  title: 'Button',
  component: ButtonComponent,
};
export default meta;

export const Primary: StoryObj<ButtonComponent> = {};
