import type { ErosError } from '../errors';
import type { ErrorRecord } from '../utils';

/**
 * What a boundary hands to the log once per error: the error as eros sees it and its record. It holds
 * no level: the logger, or the wiring's table until there is one, chooses it.
 */
interface ErrorEvent {
  readonly error: ErosError;
  readonly record: ErrorRecord;
}

export type { ErrorEvent };
