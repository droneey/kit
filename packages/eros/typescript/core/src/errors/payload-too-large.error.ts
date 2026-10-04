import { ErrorKind } from '../constants';
import type { ErosErrorInput } from './eros.error';
import { ExpectedError } from './expected.error';

class PayloadTooLargeError extends ExpectedError {
  public constructor(input: ErosErrorInput = {}) {
    super(ErrorKind.PayloadTooLarge, input);
  }
}

export { PayloadTooLargeError };
