import { ErrorKind } from '../constants';
import type { ErosErrorInput } from './eros.error';
import { ExpectedError } from './expected.error';

class RateLimitedError extends ExpectedError {
  public constructor(input: ErosErrorInput = {}) {
    super(ErrorKind.RateLimited, input);
  }
}

export { RateLimitedError };
