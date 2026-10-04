import { ErrorKind } from '../constants';
import type { ErosErrorInput } from './eros.error';
import { ExpectedError } from './expected.error';

/**
 * The request is well formed, but a business invariant says no. A reason in the meta is welcome
 * and never required: `orders/order/violation/already-paid`.
 */
class ViolationError extends ExpectedError {
  public constructor(input: ErosErrorInput = {}) {
    super(ErrorKind.Violation, input);
  }
}

export { ViolationError };
