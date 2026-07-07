import { CardComponent } from './card.component';

// Layout-B CLEAN aggregated story (SB-06 criterion 1). Lives OUTSIDE the host dir,
// reached via the widened ./.storybook include -- a declared rootName of the host's
// input set. Plain Angular `.ts`, no @storybook/angular import, so a planted error
// yields the ONE deliberate diagnostic. DISTINCT code from Layout A (TS2345 here vs
// Layout A's TS2322) so a single stdout token cannot false-attribute across layouts
// (Pitfall 6).
//
// The `story(3)` call below is the CLEAN ANCHOR the e2e replaces to plant a TS2345
// (a string passed where the `order: number` parameter is required). Keep it on its
// own line.
interface Story {
  component: typeof CardComponent;
  order: number;
}

function story(order: number): Story {
  return { component: CardComponent, order };
}

export const primary: Story = story(3);
