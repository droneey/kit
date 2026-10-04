import { describe, expect, test } from 'bun:test';

import { NotFoundError, UnexpectedError } from '../../errors';
import { hasCode } from '../has-code.utils';

class OrderNotFoundError extends NotFoundError {
  public constructor() {
    super({
      meta: {
        module: 'orders',
        entity: 'order',
      },
    });
  }
}

const foreignWithCode = Object.assign(new Error('Not found.'), {
  code: 'orders/order/not-found',
});

describe('hasCode', () => {
  test.each([
    [
      'the expected error has the code',
      {
        error: new OrderNotFoundError(),
        code: 'orders/order/not-found',
      },
      true,
    ],
    [
      'the expected error has another code',
      {
        error: new OrderNotFoundError(),
        code: 'orders/order/expired',
      },
      false,
    ],
    [
      'the error is unexpected',
      {
        error: new UnexpectedError(),
        code: 'internal',
      },
      false,
    ],
    [
      'a foreign error carries the code',
      {
        error: foreignWithCode,
        code: 'orders/order/not-found',
      },
      false,
    ],
    [
      'the value is not an error',
      {
        error: 'orders/order/not-found',
        code: 'orders/order/not-found',
      },
      false,
    ],
  ])(
    'should tell whether it is an expected error of the code when %s',
    (_condition, { error, code }, isExpected) => {
      // Arrange
      // Act
      const isOfCode = hasCode(error, code);

      // Assert
      expect(isOfCode).toBe(isExpected);
    },
  );
});
