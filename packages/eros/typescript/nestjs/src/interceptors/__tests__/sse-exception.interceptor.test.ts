import { afterAll, describe, expect, test } from 'bun:test';

import type { ErrorEvent } from '@droneey/eros';
import { ErrorKind, ForbiddenError } from '@droneey/eros';
import type { INestApplication } from '@nestjs/common';
import { ConflictException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/internal';
import type { Observable } from 'rxjs';
import { lastValueFrom, of, toArray } from 'rxjs';

import { requestGet, startApp } from '../../__tests__/app.fixtures';
import { withoutStacks } from '../../__tests__/error-event.fixtures';
import { ORDER_NOT_FOUND_RECORD } from '../../__tests__/order-not-found-error.fixtures';
import type { SseExceptionInterceptorInput } from '../sse-exception.interceptor';
import { SseExceptionInterceptor } from '../sse-exception.interceptor';
import {
  failingAfterOneEvent,
  failingAtOnce,
  OrderEventsController,
  orderNotFound,
  PAID_EVENT,
} from './order-events-controller.fixtures';

interface InterceptInput {
  readonly handled: Observable<unknown>;
  readonly route: (...args: never[]) => unknown;
  readonly wiring?: Omit<SseExceptionInterceptorInput, 'reflector'>;
}

const intercept = async ({ wiring, route, handled }: InterceptInput): Promise<unknown[]> =>
  await lastValueFrom(
    new SseExceptionInterceptor({
      reflector: new Reflector(),
      ...wiring,
    })
      .intercept(new ExecutionContextHost([], OrderEventsController, route), {
        handle: () => handled,
      })
      .pipe(toArray()),
  );

const streamRoute = OrderEventsController.prototype.streamOrderEvents;

let app: INestApplication | undefined;

afterAll(async () => {
  await app?.close();
});

describe('SseExceptionInterceptor', () => {
  test('should send the error event as the last message of a real SSE response', async () => {
    // Arrange
    app = await startApp({
      controllers: [
        OrderEventsController,
      ],
      wire: (nest) => {
        nest.useGlobalInterceptors(
          new SseExceptionInterceptor({
            reflector: nest.get(Reflector),
          }),
        );
      },
    });

    // Act
    const response = await requestGet(app, '/orders/events');

    // Assert
    expect(response.body).toBe(
      '\nid: 1\ndata: {"status":"paid"}\n\nevent: error\nid: 2\ndata: {"type":"about:blank","title":"Not Found","status":404,"detail":"Order 42 not found.","code":"orders/order/not-found","isRetryable":false}\n\n',
    );
  });

  test.each([
    [
      'the handler gives the stream itself',
      failingAfterOneEvent(orderNotFound),
    ],
    [
      'the handler gives the stream through a promise',
      of(failingAfterOneEvent(orderNotFound)),
    ],
  ])(
    'should end a failing stream with an error event that carries the problem when %s',
    async (_condition, handled) => {
      // Arrange
      // Act
      const events = await intercept({
        route: streamRoute,
        handled,
      });

      // Assert
      expect(events).toStrictEqual([
        PAID_EVENT,
        {
          type: 'error',
          data: {
            type: 'about:blank',
            title: 'Not Found',
            status: 404,
            detail: 'Order 42 not found.',
            code: 'orders/order/not-found',
            isRetryable: false,
          },
        },
      ]);
    },
  );

  test('should answer with an error event when the handler fails before it gives a stream', async () => {
    // Arrange
    // Act
    const events = await intercept({
      route: streamRoute,
      handled: failingAtOnce(
        new ForbiddenError({
          message: 'Only an owner may follow this order.',
        }),
      ),
    });

    // Assert
    expect(events).toStrictEqual([
      {
        type: 'error',
        data: {
          type: 'about:blank',
          title: 'Forbidden',
          status: 403,
          detail: 'Only an owner may follow this order.',
          code: 'forbidden',
          isRetryable: false,
        },
      },
    ]);
  });

  test('should translate a Nest exception by the table, type base and trace it is given', async () => {
    // Arrange
    // Act
    const events = await intercept({
      wiring: {
        httpExceptions: new Map([
          [
            409,
            ErrorKind.Conflict,
          ],
        ]),
        typeBase: 'https://errors.example.com',
        getTraceId: (host) => `trace-of-${host.getType()}`,
      },
      route: streamRoute,
      handled: failingAtOnce(new ConflictException('The order changed.')),
    });

    // Assert
    expect(events).toStrictEqual([
      {
        type: 'error',
        data: {
          type: 'https://errors.example.com/conflict',
          title: 'Conflict',
          status: 409,
          detail: 'Resource conflict.',
          code: 'conflict',
          isRetryable: false,
          traceId: 'trace-of-http',
        },
      },
    ]);
  });

  test('should report the error of a stream with its record', async () => {
    // Arrange
    const reports: unknown[] = [];

    // Act
    await intercept({
      wiring: {
        onError: (report) => {
          reports.push(withoutStacks(report));
        },
      },
      route: streamRoute,
      handled: failingAfterOneEvent(orderNotFound),
    });

    // Assert
    expect(reports).toStrictEqual([
      {
        error: orderNotFound,
        record: ORDER_NOT_FOUND_RECORD,
      },
    ]);
  });

  test('should leave the error of a route that is not SSE to the exception filter, unreported', async () => {
    // Arrange
    const reports: ErrorEvent[] = [];

    // Act
    const failure = intercept({
      wiring: {
        onError: (report) => {
          reports.push(report);
        },
      },
      route: OrderEventsController.prototype.readLatestOrder,
      handled: failingAtOnce(orderNotFound),
    });

    // Assert
    expect({
      error: await failure.catch((error: unknown) => error),
      reports,
    }).toStrictEqual({
      error: orderNotFound,
      reports: [],
    });
  });
});
