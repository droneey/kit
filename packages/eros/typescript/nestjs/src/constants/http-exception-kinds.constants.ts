import { ErrorKind } from '@droneey/eros';
import { PROJECTIONS } from '@droneey/eros-wire';

/**
 * Each status of the kinds' table and its kind, for the wiring to hand to the filter when Nest's own
 * exceptions should become errors of eros: 404 is `not-found`, 409 is `conflict`.
 */
const NEST_HTTP_EXCEPTION_KINDS: ReadonlyMap<number, ErrorKind> = new Map(
  Object.values(ErrorKind).map(
    (kind) =>
      [
        PROJECTIONS[kind].http,
        kind,
      ] as const,
  ),
);

export { NEST_HTTP_EXCEPTION_KINDS };
