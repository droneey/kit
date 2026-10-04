import type { ErosErrorInput } from '@droneey/eros';
import { NotFoundError } from '@droneey/eros';

/** The error of a feature, as spec §3 declares one: orders/order/not-found. */
class OrderNotFoundError extends NotFoundError {
  public constructor(input: ErosErrorInput = {}) {
    super({
      message: 'Order 42 not found.',
      ...input,
      meta: {
        module: 'orders',
        entity: 'order',
      },
    });
  }
}

/** The record of an OrderNotFoundError as the log writes it, its stack left out. */
const ORDER_NOT_FOUND_RECORD = {
  code: 'orders/order/not-found',
  module: 'orders',
  entity: 'order',
  kind: 'not-found',
  category: 'expected',
  title: 'Not Found',
  message: 'Order 42 not found.',
  isRetryable: false,
};

export { ORDER_NOT_FOUND_RECORD, OrderNotFoundError };
