// Authored strict reflection for the Host face, modelled on the reflection DSH's own
// packages ship. There are no strict codecs, so `schemas` stays empty: the single
// invocation carries `src-json` codecs that need no factory.
import { SESSION_DELETE_DESCRIPTOR } from './remote.js';

export const TYPERT = {
  package: 'dsh-plugin-session-delete',
  face: 'host',
  schemas: [],
  invocations: [SESSION_DELETE_DESCRIPTOR],
  model: {
    services: [
      {
        key: 'sessionDelete',
        exportName: 'SessionDeleteService',
        description: 'Permanently delete one stored chat session: its log directory, its projection-cache record and its workspace membership.',
        summary: 'Delete a conversation and its stored data',
        tags: [],
        members: [
          {
            kind: 'method',
            name: 'delete',
            signature: 'async delete(request: { readonly sessionId: string }): Promise<{ readonly sessionId: string; readonly removed: readonly string[]; readonly detached: boolean; readonly skipped: readonly string[] }>',
          },
        ],
        types: [],
      },
    ],
    events: [],
    objects: [],
  },
};

export default TYPERT;
