import { ErrorKind } from '../constants';
import type { ErosErrorInput } from './eros.error';
import { ExpectedError } from './expected.error';

class UnavailableError extends ExpectedError {
  public constructor(input: ErosErrorInput = {}) {
    super(ErrorKind.Unavailable, input);
  }
}

export { UnavailableError };
