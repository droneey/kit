import { ErrorKind } from '../constants';
import type { ErosErrorInput } from './eros.error';
import { ExpectedError } from './expected.error';

class NotFoundError extends ExpectedError {
  public constructor(input: ErosErrorInput = {}) {
    super(ErrorKind.NotFound, input);
  }
}

export { NotFoundError };
