import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

import type { ErrorEvent } from '@droneey/eros';
import { ErrorKind } from '@droneey/eros';
import type { INestApplication } from '@nestjs/common';
import { CqrsModule, EventBus, UnhandledExceptionBus } from '@nestjs/cqrs';
import { Test } from '@nestjs/testing';

import { stripStacks, withoutStacks } from '../../__tests__/error-event.fixtures';
import { AllExceptionsHandler } from '../all-exceptions.handler';
import { OrderPaidEvent } from './order-paid-event.fixtures';
import { mailDown, SendReceiptHandler } from './send-receipt-handler.fixtures';

const orderPaid = new OrderPaidEvent('42');

let app: INestApplication;
let bus: UnhandledExceptionBus;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [
      CqrsModule.forRoot(),
    ],
    providers: [
      SendReceiptHandler,
    ],
  }).compile();

  app = moduleRef.createNestApplication({
    logger: false,
  });
  await app.init();
  bus = app.get(UnhandledExceptionBus);
});

afterAll(async () => {
  await app.close();
});

const reportOnce = (): Promise<ErrorEvent> =>
  new Promise((resolve) => {
    const subscription = new AllExceptionsHandler({
      onError: (report) => {
        subscription.unsubscribe();
        resolve(report);
      },
    }).subscribe(bus);
  });

describe('AllExceptionsHandler', () => {
  test('should report what an event handler threw, with its record', async () => {
    // Arrange
    const reported = reportOnce();

    // Act
    app.get(EventBus).publish(orderPaid);

    // Assert
    expect(withoutStacks(await reported)).toStrictEqual({
      error: mailDown,
      record: {
        code: 'unavailable',
        kind: 'unavailable',
        category: 'expected',
        title: 'Service Unavailable',
        message: 'The mail service is down.',
        isRetryable: true,
      },
    });
  });

  test('should report an error that is not of eros as an unexpected one that holds it', async () => {
    // Arrange
    const thrown = new TypeError('receipt.lines is undefined');
    const reported = reportOnce();

    // Act
    bus.publish({
      cause: orderPaid,
      exception: thrown,
    });
    const { error, record } = await reported;

    // Assert
    expect({
      kind: error.kind,
      cause: error.cause,
      record: stripStacks(record),
    }).toStrictEqual({
      kind: ErrorKind.Internal,
      cause: thrown,
      record: {
        code: 'internal',
        kind: 'internal',
        category: 'unexpected',
        title: 'Internal Server Error',
        message: 'An unexpected error occurred.',
        isRetryable: false,
        cause: {
          name: 'TypeError',
          message: 'receipt.lines is undefined',
        },
      },
    });
  });

  test('should stop reporting once its subscription ends', () => {
    // Arrange
    const reports: ErrorEvent[] = [];
    const subscription = new AllExceptionsHandler({
      onError: (report) => {
        reports.push(report);
      },
    }).subscribe(bus);
    subscription.unsubscribe();

    // Act
    bus.publish({
      cause: orderPaid,
      exception: mailDown,
    });

    // Assert
    expect(reports).toStrictEqual([]);
  });
});
