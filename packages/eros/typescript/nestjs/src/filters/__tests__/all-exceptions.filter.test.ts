import { afterEach, describe, expect, test } from 'bun:test';

import type { ErrorEvent } from '@droneey/eros';
import { ErrorKind } from '@droneey/eros';
import type { INestApplication } from '@nestjs/common';
import type { Response } from 'light-my-request';

import { requestGet, startApp } from '../../__tests__/app.fixtures';
import { withoutStacks } from '../../__tests__/error-event.fixtures';
import { ORDER_NOT_FOUND_RECORD } from '../../__tests__/order-not-found-error.fixtures';
import { NEST_HTTP_EXCEPTION_KINDS } from '../../constants';
import type { AllExceptionsFilterInput } from '../all-exceptions.filter';
import { AllExceptionsFilter } from '../all-exceptions.filter';
import {
  FailingOrdersController,
  ledgerBroken,
  orderChanged,
  orderNotFound,
} from './failing-orders-controller.fixtures';

let app: INestApplication | undefined;

const startWith = async (
  input: Omit<AllExceptionsFilterInput, 'httpAdapter'> = {},
): Promise<INestApplication> => {
  app = await startApp({
    controllers: [
      FailingOrdersController,
    ],
    wire: (nest) => {
      nest.useGlobalFilters(
        new AllExceptionsFilter({
          httpAdapter: nest.getHttpAdapter(),
          ...input,
        }),
      );
    },
  });

  return app;
};

interface ReportedResponse {
  readonly events: readonly ErrorEvent[];
  readonly response: Response;
  /** The events as a case compares them, each record without its stacks. */
  readonly stacklessEvents: readonly unknown[];
}

const requestReported = async (
  url: string,
  input: Omit<AllExceptionsFilterInput, 'httpAdapter' | 'onError'> = {},
): Promise<ReportedResponse> => {
  const events: ErrorEvent[] = [];
  const stacklessEvents: unknown[] = [];
  const started = await startWith({
    ...input,
    onError: (event) => {
      events.push(event);
      stacklessEvents.push(withoutStacks(event));
    },
  });
  const response = await requestGet(started, url);

  return {
    response,
    events,
    stacklessEvents,
  };
};

const MASKED_PROBLEM = {
  type: 'about:blank',
  title: 'Internal Server Error',
  status: 500,
  detail: 'An unexpected error occurred.',
  code: 'internal',
  isRetryable: false,
};

afterEach(async () => {
  await app?.close();
});

describe('AllExceptionsFilter', () => {
  test('should answer with the status and the problem as application/problem+json when the error is expected', async () => {
    // Arrange
    const started = await startWith();

    // Act
    const response = await requestGet(started, '/orders/missing');

    // Assert
    expect({
      status: response.statusCode,
      contentType: response.headers['content-type'],
      body: response.json<unknown>(),
    }).toStrictEqual({
      status: 404,
      contentType: 'application/problem+json; charset=utf-8',
      body: {
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: 'Order 42 not found.',
        code: 'orders/order/not-found',
        isRetryable: false,
      },
    });
  });

  test('should answer with what failed when the error is a validation', async () => {
    // Arrange
    const started = await startWith();

    // Act
    const response = await requestGet(started, '/orders/invalid');

    // Assert
    expect(response.json<unknown>()).toStrictEqual({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: 'Validation failed.',
      code: 'validation',
      isRetryable: false,
      errors: [
        {
          pointer: '#/items/0/quantity',
          code: 'invalid-format',
          detail: 'must be a positive integer',
        },
      ],
    });
  });

  test('should set Retry-After in whole seconds, rounded up, when the error says when to retry', async () => {
    // Arrange
    const started = await startWith();

    // Act
    const response = await requestGet(started, '/orders/busy');

    // Assert
    expect({
      status: response.statusCode,
      retryAfter: response.headers['retry-after'],
      body: response.json<unknown>(),
    }).toStrictEqual({
      status: 429,
      retryAfter: '2',
      body: {
        type: 'about:blank',
        title: 'Too Many Requests',
        status: 429,
        detail: 'Too many requests.',
        code: 'rate-limited',
        isRetryable: true,
        retryAfterSeconds: 2,
      },
    });
  });

  test('should set no Retry-After when the error does not say when to retry', async () => {
    // Arrange
    const started = await startWith();

    // Act
    const response = await requestGet(started, '/orders/missing');

    // Assert
    expect(response.headers['retry-after']).toBeUndefined();
  });

  test('should mask the error as an internal one when it is not of eros', async () => {
    // Arrange
    const started = await startWith();

    // Act
    const response = await requestGet(started, '/orders/broken');

    // Assert
    expect({
      status: response.statusCode,
      body: response.json<unknown>(),
    }).toStrictEqual({
      status: 500,
      body: MASKED_PROBLEM,
    });
  });

  test.each([
    [
      'a route that does not exist',
      '/nowhere',
    ],
    [
      'a ConflictException',
      '/orders/changed',
    ],
  ])(
    'should mask a Nest exception when no table is given and it comes from %s',
    async (_condition, url) => {
      // Arrange
      const started = await startWith();

      // Act
      const response = await requestGet(started, url);

      // Assert
      expect({
        status: response.statusCode,
        body: response.json<unknown>(),
      }).toStrictEqual({
        status: 500,
        body: MASKED_PROBLEM,
      });
    },
  );

  test.each([
    [
      'a route that does not exist',
      '/nowhere',
      {
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: 'Resource not found.',
        code: 'not-found',
        isRetryable: false,
      },
    ],
    [
      'a throttler that refuses the request',
      '/orders/throttled',
      {
        type: 'about:blank',
        title: 'Too Many Requests',
        status: 429,
        detail: 'Too many requests.',
        code: 'rate-limited',
        isRetryable: true,
      },
    ],
    [
      'a BadRequestException',
      '/orders/malformed',
      {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        detail: 'Validation failed.',
        code: 'validation',
        isRetryable: false,
        errors: [],
      },
    ],
    [
      'a ConflictException',
      '/orders/changed',
      {
        type: 'about:blank',
        title: 'Conflict',
        status: 409,
        detail: 'Resource conflict.',
        code: 'conflict',
        isRetryable: false,
      },
    ],
  ])(
    'should answer with the kind of the status and its default text when the table is given and the exception comes from %s',
    async (_condition, url, problem) => {
      // Arrange
      const started = await startWith({
        httpExceptions: NEST_HTTP_EXCEPTION_KINDS,
      });

      // Act
      const response = await requestGet(started, url);

      // Assert
      expect(response.json<unknown>()).toStrictEqual(problem);
    },
  );

  test('should log the message of a translated Nest exception as the cause when the table is given', async () => {
    // Arrange
    // Act
    const {
      events: [event],
    } = await requestReported('/orders/changed', {
      httpExceptions: NEST_HTTP_EXCEPTION_KINDS,
    });

    // Assert
    expect({
      kind: event?.error.kind,
      cause: event?.error.cause,
      loggedMessage: event?.record.cause?.message,
    }).toStrictEqual({
      kind: ErrorKind.Conflict,
      cause: orderChanged,
      loggedMessage: 'The order changed.',
    });
  });

  test('should build the type from the type base and add the trace it reads from the request', async () => {
    // Arrange
    const started = await startWith({
      typeBase: 'https://errors.example.com',
      getTraceId: (host) =>
        host.switchToHttp().getRequest<{
          readonly url: string;
        }>().url,
    });

    // Act
    const response = await requestGet(started, '/orders/missing');

    // Assert
    expect(response.json<unknown>()).toStrictEqual({
      type: 'https://errors.example.com/orders/order/not-found',
      title: 'Not Found',
      status: 404,
      detail: 'Order 42 not found.',
      code: 'orders/order/not-found',
      isRetryable: false,
      traceId: '/orders/missing',
    });
  });

  test('should report the error once with its record when the error is expected', async () => {
    // Arrange
    // Act
    const { stacklessEvents } = await requestReported('/orders/missing');

    // Assert
    expect(stacklessEvents).toStrictEqual([
      {
        error: orderNotFound,
        record: ORDER_NOT_FOUND_RECORD,
      },
    ]);
  });

  test('should report an unexpected error that holds it when the error is not of eros', async () => {
    // Arrange
    // Act
    const {
      events: [event],
    } = await requestReported('/orders/broken');

    // Assert
    expect({
      kind: event?.error.kind,
      cause: event?.error.cause,
    }).toStrictEqual({
      kind: ErrorKind.Internal,
      cause: ledgerBroken,
    });
  });

  test('should end the response without a problem and still report the error when its headers are sent', async () => {
    // Arrange
    // Act
    const { response, stacklessEvents } = await requestReported('/orders/streamed');

    // Assert
    expect({
      status: response.statusCode,
      body: response.body,
      stacklessEvents,
    }).toStrictEqual({
      status: 200,
      body: '',
      stacklessEvents: [
        {
          error: orderNotFound,
          record: ORDER_NOT_FOUND_RECORD,
        },
      ],
    });
  });
});
