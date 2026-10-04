import type { MessageEvent } from '@nestjs/common';
import { Controller, Get, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';

import { OrderNotFoundError } from '../../__tests__/order-not-found-error.fixtures';

const orderNotFound = new OrderNotFoundError();

const PAID_EVENT = {
  data: {
    status: 'paid',
  },
};

const failingAfterOneEvent = (thrown: unknown): Observable<MessageEvent> =>
  new Observable((subscriber) => {
    subscriber.next(PAID_EVENT);
    subscriber.error(thrown);
  });

const failingAtOnce = (thrown: unknown): Observable<never> =>
  new Observable((subscriber) => {
    subscriber.error(thrown);
  });

/** Its routes carry the metadata of an SSE route and of a plain one; the unit cases call neither. */
@Controller('orders')
class OrderEventsController {
  @Sse('events')
  public streamOrderEvents(): Observable<MessageEvent> {
    return failingAfterOneEvent(orderNotFound);
  }

  @Get('latest')
  public readLatestOrder(): string {
    return 'order';
  }
}

export { failingAfterOneEvent, failingAtOnce, OrderEventsController, orderNotFound, PAID_EVENT };
