import type { ErrorKind } from '../constants';
import type { ErosErrorInput } from './eros.error';
import { ErosError } from './eros.error';

type ExpectedKind = Exclude<ErrorKind, ErrorKind.Internal>;

/** A failure the program foresaw: the client sees its code and its message. */
abstract class ExpectedError extends ErosError {
  declare public readonly kind: ExpectedKind;

  public constructor(kind: ExpectedKind, input: ErosErrorInput) {
    super(kind, input);
  }
}

export type { ExpectedKind };
export { ExpectedError };
