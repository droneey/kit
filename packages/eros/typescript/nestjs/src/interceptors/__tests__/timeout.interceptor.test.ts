import { afterEach, describe, expect, test } from 'bun:test';

import { NotFoundError, TimeoutError } from '@droneey/eros';
import type { INestApplication, MessageEvent } from '@nestjs/common';
import { Controller, Get, Sse } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/internal';
import type { SchedulerLike } from 'rxjs';
import {
  interval,
  lastValueFrom,
  NEVER,
  Observable,
  TimeoutError as RxTimeoutError,
  take,
  toArray,
  VirtualTimeScheduler,
} from 'rxjs';

import { requestGet, startApp } from '../../__tests__/app.fixtures';
import { AllExceptionsFilter } from '../../filters';
import { TimeoutInterceptor } from '../timeout.interceptor';
import { ExpiredClock } from './scheduler.fake';

const TIMEOUT = Temporal.Duration.from({
  seconds: 30,
});

const PAST_THE_TIMEOUT_MS = 60_000;

@Controller('orders')
class SlowOrdersController {
  @Get('slow')
  public readSlowOrder(): Observable<never> {
    return NEVER;
  }

  @Get('latest')
  public readLatestOrder(): string {
    return 'order';
  }

  @Sse('events')
  public streamOrderEvents(): Observable<MessageEvent> {
    return NEVER;
  }
}

interface InterceptInput {
  readonly clock: VirtualTimeScheduler;
  readonly handled: Observable<unknown>;
  readonly route: (...args: never[]) => unknown;
}

/** Runs the clock until nothing is left on it, and gives what the stream ended with. */
const intercept = async ({ clock, route, handled }: InterceptInput): Promise<unknown> => {
  const outcome = lastValueFrom(
    new TimeoutInterceptor({
      reflector: new Reflector(),
      scheduler: clock,
      timeout: TIMEOUT,
    })
      .intercept(new ExecutionContextHost([], SlowOrdersController, route), {
        handle: () => handled,
      })
      .pipe(toArray()),
  );

  clock.flush();

  try {
    return await outcome;
  } catch (error: unknown) {
    return error;
  }
};

const startTimedApp = async (clock: SchedulerLike): Promise<INestApplication> =>
  await startApp({
    controllers: [
      SlowOrdersController,
    ],
    wire: (nest) => {
      nest.useGlobalInterceptors(
        new TimeoutInterceptor({
          reflector: nest.get(Reflector),
          scheduler: clock,
          timeout: TIMEOUT,
        }),
      );
      nest.useGlobalFilters(
        new AllExceptionsFilter({
          httpAdapter: nest.getHttpAdapter(),
        }),
      );
    },
  });

let app: INestApplication | undefined;

afterEach(async () => {
  await app?.close();
});

describe('TimeoutInterceptor', () => {
  test('should answer a request whose handler outlives the timeout with a Timeout problem', async () => {
    // Arrange
    app = await startTimedApp(new ExpiredClock());

    // Act
    const response = await requestGet(app, '/orders/slow');

    // Assert
    expect({
      status: response.statusCode,
      body: response.json<unknown>(),
    }).toStrictEqual({
      status: 504,
      body: {
        type: 'about:blank',
        title: 'Gateway Timeout',
        status: 504,
        detail: 'A dependency did not answer in time.',
        code: 'timeout',
        isRetryable: true,
      },
    });
  });

  test('should answer a request whose handler is in time with what it returns', async () => {
    // Arrange
    app = await startTimedApp(new VirtualTimeScheduler());

    // Act
    const response = await requestGet(app, '/orders/latest');

    // Assert
    expect(response.body).toBe('order');
  });

  test('should keep the timeout of the stream as the cause of the TimeoutError', async () => {
    // Arrange
    const clock = new VirtualTimeScheduler();

    // Act
    const failure = await intercept({
      clock,
      route: SlowOrdersController.prototype.readSlowOrder,
      handled: NEVER,
    });

    // Assert
    expect({
      isTimeout: failure instanceof TimeoutError,
      isCausedByStream: failure instanceof TimeoutError && failure.cause instanceof RxTimeoutError,
    }).toStrictEqual({
      isTimeout: true,
      isCausedByStream: true,
    });
  });

  test('should let any other error of the handler through unchanged', async () => {
    // Arrange
    const clock = new VirtualTimeScheduler();
    const thrown = new NotFoundError();

    // Act
    const failure = await intercept({
      clock,
      route: SlowOrdersController.prototype.readLatestOrder,
      handled: new Observable((subscriber) => {
        subscriber.error(thrown);
      }),
    });

    // Assert
    expect(failure).toBe(thrown);
  });

  test('should leave an SSE stream to run past the timeout', async () => {
    // Arrange
    const clock = new VirtualTimeScheduler();

    // Act
    const events = await intercept({
      clock,
      route: SlowOrdersController.prototype.streamOrderEvents,
      handled: interval(PAST_THE_TIMEOUT_MS, clock).pipe(take(1)),
    });

    // Assert
    expect(events).toStrictEqual([
      0,
    ]);
  });
});
