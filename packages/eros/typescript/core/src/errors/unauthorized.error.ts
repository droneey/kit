import { ErrorKind } from '../constants';
import type { ErosErrorInput } from './eros.error';
import { ExpectedError } from './expected.error';

class UnauthorizedError extends ExpectedError {
  public constructor(input: ErosErrorInput = {}) {
    super(ErrorKind.Unauthorized, input);
  }
}

export { UnauthorizedError };
