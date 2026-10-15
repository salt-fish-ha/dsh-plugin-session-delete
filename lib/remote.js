// Wire descriptors for dsh-plugin-session-delete.
//
// Hand-authored strict reflection, validated by the same code that validates DSH's own
// generated reflections (`dsh-typert-loader` for the `./typert` export, `dsh-typert-registry`
// plus `dsh-api-gateway`'s `requireStrictInputs` for the client contribution).
//
// Rules this file obeys, all verified against the shipped validators:
//   - `mode` is OMITTED: it accepts only `'stream'` or absent, and unary methods must not
//     declare it (`openStream` rejects a descriptor without `mode`; `invokePrepared`
//     rejects one with it).
//   - `invocation.kind` is `'direct'`; `parameters` (array) and `result` are required.
//   - EVERY client-supplied field needs a `mode: 'strict'` codec. `src-json` is accepted by
//     the registry but rejected by the client's `requireStrictInputs`, so parameters may not
//     use it.
//   - a strict codec needs only a non-empty `typeSymbol` and a `create` factory; the ONLY
//     method DSH ever calls on the returned object is `parse(value)`. That is why this
//     plugin needs no schema library and no vendored Zod.

/**
 * Build the validator for one delete request.
 * @returns a schema whose `parse` rejects a request without a usable session id.
 */
export function sessionDeleteRequestSchema() {
  return {
    parse(value) {
      if (value === null || typeof value !== 'object') {
        throw new TypeError('session-delete: request must be an object');
      }
      const sessionId = value.sessionId;
      if (typeof sessionId !== 'string' || sessionId.length === 0) {
        throw new TypeError('session-delete: request.sessionId must be a non-empty string');
      }
      return value;
    },
  };
}

/**
 * Build the validator for the delete result. The Host only ever encodes this value, but the
 * strict codec keeps the descriptor valid on every path.
 * @returns a pass-through schema.
 */
export function sessionDeleteResultSchema() {
  return { parse(value) { return value; } };
}

/** The single unary endpoint: permanently delete one session. */
export const SESSION_DELETE_DESCRIPTOR = {
  id: 'dsh-plugin-session-delete#sessionDelete/delete',
  service: 'sessionDelete',
  namespace: 'sessionDelete',
  method: 'delete',
  invocation: { kind: 'direct' },
  parameters: [
    {
      name: 'request',
      wire: 'request',
      source: 'json',
      codec: {
        mode: 'strict',
        typeSymbol: 'dsh-plugin-session-delete#SessionDeleteRequest',
        create: sessionDeleteRequestSchema,
      },
    },
  ],
  result: {
    mode: 'strict',
    typeSymbol: 'dsh-plugin-session-delete#SessionDeleteResult',
    create: sessionDeleteResultSchema,
  },
};

/** The Remote half of the reflection, consumed by the Gateway and by the client `$mount`. */
export const TYPERT_REMOTE = {
  package: 'dsh-plugin-session-delete',
  descriptors: [SESSION_DELETE_DESCRIPTOR],
};
