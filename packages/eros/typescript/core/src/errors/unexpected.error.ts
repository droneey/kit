import { ErrorKind } from '../constants';
import type { ErrorDetails } from './eros.error';
import { ErosError } from './eros.error';

interface UnexpectedErrorInput {
  readonly cause?: unknown;
  readonly details?: ErrorDetails;
  readonly message?: string;
}

/**
 * A bug or a state that cannot be: the client gets a masked 500, and a person is woken. Its code is
 * always `internal`, with no module, entity or reason.
 */
class UnexpectedError extends ErosError {
  declare public readonly kind: ErrorKind.Internal;

  public constructor(input: UnexpectedErrorInput = {}) {
    super(ErrorKind.Internal, input);
  }
}

export type { UnexpectedErrorInput };
export { UnexpectedError };
