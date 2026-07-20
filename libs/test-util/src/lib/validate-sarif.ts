import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

/**
 * A dev-only SARIF 2.1.0 schema validator (VER-02 / D-01), shared by the VER-02
 * integration specs AND the VER-03 shipped-tarball e2e specs so ONE validator
 * proves conformance everywhere. It validates the REAL `formatSarifReport` output
 * against the COMMITTED SARIF 2.1.0 JSON schema -- never a fetch at test time, never
 * a shape-only assertion.
 *
 * The committed `sarif-2.1.0.schema.json` is the SchemaStore copy: draft-07 with an
 * `$id`, so plain `ajv@^8` (draft-07 is its default) handles it -- NOT `ajv-draft-04`.
 * The schema references the `uri` / `uri-reference` / `date-time` string formats, so
 * `ajv-formats` MUST register them; `strict: false` keeps the ~109 KB schema from
 * tripping ajv strict-mode complaints. The schema is read + compiled lazily on the
 * first `validateSarif()` call and memoized (NOT at module load), so importing
 * `@workspace/test-util` for an unrelated helper never parses the ~109 KB schema.
 *
 * The fixture lives beside this validator under `libs/test-util` (path-aliased,
 * never published) -- NOT under the plugin `src/`, where the `files: ["src"]`
 * allowlist would ship a dev-only 109 KB schema and trip the tarball leak guard
 * (Pitfall 4). `__dirname` (not `import.meta.url`) is the resolver because the lib
 * builds under `module: commonjs`, where `import.meta` is forbidden.
 */
let compiled: ValidateFunction | undefined;

function getValidator(): ValidateFunction {
  if (compiled === undefined) {
    const schema: unknown = JSON.parse(
      readFileSync(join(__dirname, 'sarif-2.1.0.schema.json'), 'utf8'),
    );

    const ajv = new Ajv({ strict: false, allErrors: true });
    addFormats(ajv);
    compiled = ajv.compile(schema as object);
  }

  return compiled;
}

/**
 * Validates a raw SARIF JSON STRING against the committed SARIF 2.1.0 schema.
 *
 * `JSON.parse(sarifJson)` is intentionally UNCAUGHT: a throw here is the
 * stdout-purity signal (impure stdout -- Nx chrome / advisory text glued onto the
 * payload -- fails to parse), reused by the 32-02 e2e specs. On a schema failure the
 * returned `errors` carries the stringified ajv error objects so the caller can pass
 * it as the assertion message.
 */
export function validateSarif(sarifJson: string): {
  valid: boolean;
  errors: string;
} {
  const validateSarifSchema = getValidator();
  const data: unknown = JSON.parse(sarifJson);
  const valid = validateSarifSchema(data) === true;

  return {
    valid,
    errors: valid ? '' : JSON.stringify(validateSarifSchema.errors, null, 2),
  };
}
