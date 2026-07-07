import { CardComponent } from './card.component';

// Composed-lib CLEAN story (Composition topology, plan 19-02). A PLAIN Angular
// `.ts` -- it does NOT import @storybook/angular, so a planted error yields the ONE
// deliberate diagnostic. Declared as a rootName of ./.storybook/tsconfig.json, so
// lib-cards' OWN typecheck target type-checks it.
//
// The `count: 5,` line below is a clean plantable anchor (distinct from lib-buttons'
// `count: 3,`). Keep it on its own line.
interface Story {
  component: typeof CardComponent;
  count: number;
}

export const primary: Story = {
  component: CardComponent,
  count: 5,
};
