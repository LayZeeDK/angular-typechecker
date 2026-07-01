import { ConsumerComponent } from './consumer.component';

// Spec leaf source. Importing the consumer pulls the consumer AND the whole dep
// barrel into the spec leaf's Program -- so the dep's 8 components are compiled a
// SECOND time here (they were already compiled in the lib leaf). Clean: this is a
// benchmark. No test-runner globals needed.
export function makeConsumerName(component: ConsumerComponent): string {
  return component.constructor.name;
}
