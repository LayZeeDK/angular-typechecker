// Delegates to the shared createVerdaccioGlobalSetup factory (@workspace/test-util):
// the load-bearing publish-once flow + 127.0.0.1 loopback SAFETY gate live there.
import { createVerdaccioGlobalSetup } from '@workspace/test-util';

export default createVerdaccioGlobalSetup({
  label: 'angular-typechecker-install-e2e',
});
