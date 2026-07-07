import { CardComponent } from './card.component';

// Layout-B CLEAN aggregated story (out-of-host-dir, reached via the widened
// `.storybook` include). Error-free, so it contributes nothing to the verdict --
// the clean host is a fully checked PASS (criterion 4).
interface Story {
  component: typeof CardComponent;
  order: number;
}

// Clean: `order` is a valid number.
export const primary: Story = {
  component: CardComponent,
  order: 3,
};
