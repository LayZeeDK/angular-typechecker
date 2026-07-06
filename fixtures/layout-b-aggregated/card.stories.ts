import { CardComponent } from './card.component';

// Layout-B BROKEN aggregated story. It lives OUTSIDE the host dir and is reached
// only through `.storybook/tsconfig.json`'s widened `include` glob
// (`../../layout-b-aggregated/**/*.ts`), so it is a DECLARED rootName of the host's
// input set (spike 006 G2). Plain Angular `.ts` -- no `@storybook/angular`. The
// planted TS2322 proves the aggregated, out-of-host-dir story surface was
// type-checked and FAILS the verdict (criterion 1(B); threat T-17-14).
interface Story {
  component: typeof CardComponent;
  order: number;
}

// Planted TS2322: a string assigned to the number-typed `order`.
export const primary: Story = {
  component: CardComponent,
  order: 'not-a-number',
};
