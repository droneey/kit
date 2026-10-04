import { ErrorKind } from '../constants';
import type { ErosErrorInput } from './eros.error';
import { ExpectedError } from './expected.error';

class ExpiredError extends ExpectedError {
  public constructor(input: ErosErrorInput = {}) {
    super(ErrorKind.Expired, input);
  }
}

export { ExpiredError };
