import { ErrorKind } from '../constants';
import type { ErosErrorInput } from './eros.error';
import { ExpectedError } from './expected.error';

class ConflictError extends ExpectedError {
  public constructor(input: ErosErrorInput = {}) {
    super(ErrorKind.Conflict, input);
  }
}

export { ConflictError };
