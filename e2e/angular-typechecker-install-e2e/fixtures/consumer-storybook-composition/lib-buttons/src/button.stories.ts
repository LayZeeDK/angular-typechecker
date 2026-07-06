import { ButtonComponent } from './button.component';

// Composed-lib CLEAN story (Composition topology, plan 19-02). A PLAIN Angular
// `.ts` -- it does NOT import @storybook/angular, so a planted error yields the ONE
// deliberate diagnostic. Declared as a rootName of ./.storybook/tsconfig.json, so
// lib-buttons' OWN typecheck target type-checks it.
//
// The `count: 3,` line below is the CLEAN ANCHOR the e2e replaces at runtime to
// plant a TS2322 (a string assigned to the number-typed `count`). Keep it on its own
// line.
interface Story {
  component: typeof ButtonComponent;
  count: number;
}

export const primary: Story = {
  component: ButtonComponent,
  count: 3,
};
