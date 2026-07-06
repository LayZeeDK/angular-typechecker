import { ButtonComponent } from './button.component';

// Layout-A BROKEN story. A PLAIN Angular `.ts` -- it does NOT import
// `@storybook/angular`, so the ONLY diagnostic is the planted one (a file is a
// "story" by name/location, never a filename allowlist). Declared as a rootName of
// `.storybook/tsconfig.json`, so the walk's input set contains it and the boundary
// filter KEEPs its diagnostic (criterion 1(A) / criterion 5: the shipped walk
// still type-checks the Layout-A story surface).
interface Story {
  component: typeof ButtonComponent;
  count: number;
}

// Planted TS2322: a string assigned to the number-typed `count`. Proves the story
// file itself was type-checked.
export const primary: Story = {
  component: ButtonComponent,
  count: 'not-a-number',
};
