import { describe, expect, test } from 'bun:test';

import { ConflictError, NotFoundError, UnexpectedError } from '@droneey/eros';

import { OrderNotFoundError } from '../../__tests__/order-not-found-error.fixtures';
import { PROBLEM_SCHEMA } from '../../constants';
import { generateErrorResponses } from '../openapi.utils';

describe('generateErrorResponses', () => {
  test('should give one response per status, with an example per code', () => {
    // Arrange
    const errors = [
      new OrderNotFoundError(),
      new ConflictError(),
      new NotFoundError(),
    ];

    // Act
    const responses = generateErrorResponses(...errors);

    // Assert
    expect(responses).toStrictEqual([
      {
        status: 404,
        description: 'Not Found',
        content: {
          'application/problem+json': {
            schema: PROBLEM_SCHEMA,
            examples: {
              ['orders/order/not-found']: {
                summary: 'Order 42 not found.',
                value: {
                  type: 'about:blank',
                  title: 'Not Found',
                  status: 404,
                  detail: 'Order 42 not found.',
                  code: 'orders/order/not-found',
                  isRetryable: false,
                },
              },
              ['not-found']: {
                summary: 'Resource not found.',
                value: {
                  type: 'about:blank',
                  title: 'Not Found',
                  status: 404,
                  detail: 'Resource not found.',
                  code: 'not-found',
                  isRetryable: false,
                },
              },
            },
          },
        },
      },
      {
        status: 409,
        description: 'Conflict',
        content: {
          'application/problem+json': {
            schema: PROBLEM_SCHEMA,
            examples: {
              ['conflict']: {
                summary: 'Resource conflict.',
                value: {
                  type: 'about:blank',
                  title: 'Conflict',
                  status: 409,
                  detail: 'Resource conflict.',
                  code: 'conflict',
                  isRetryable: false,
                },
              },
            },
          },
        },
      },
    ]);
  });

  test('should show an unexpected error masked, as the client sees it', () => {
    // Arrange
    const error = new UnexpectedError({
      message: 'The ledger is out of balance.',
    });

    // Act
    const responses = generateErrorResponses(error);

    // Assert
    expect(responses).toStrictEqual([
      {
        status: 500,
        description: 'Internal Server Error',
        content: {
          'application/problem+json': {
            schema: PROBLEM_SCHEMA,
            examples: {
              ['internal']: {
                summary: 'An unexpected error occurred.',
                value: {
                  type: 'about:blank',
                  title: 'Internal Server Error',
                  status: 500,
                  detail: 'An unexpected error occurred.',
                  code: 'internal',
                  isRetryable: false,
                },
              },
            },
          },
        },
      },
    ]);
  });
});
