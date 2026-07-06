import { ButtonComponent } from './button.component';

// Layout-A CLEAN story. Plain Angular `.ts` (no `@storybook/angular`). Declared as
// a rootName of `.storybook/tsconfig.json` and error-free, so the run reports
// `errorCount === 0`, `suppressedInGraphErrorCount === 0`, and PASSES (criterion
// 1(A) clean side).
interface Story {
  component: typeof ButtonComponent;
  count: number;
}

// Clean: `count` is a valid number.
export const primary: Story = {
  component: ButtonComponent,
  count: 3,
};
