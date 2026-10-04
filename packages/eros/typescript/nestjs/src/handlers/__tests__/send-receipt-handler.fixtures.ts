import { UnavailableError } from '@droneey/eros';
import type { IEventHandler } from '@nestjs/cqrs';
import { EventsHandler } from '@nestjs/cqrs';

import { OrderPaidEvent } from './order-paid-event.fixtures';

const mailDown = new UnavailableError({
  message: 'The mail service is down.',
});

@EventsHandler(OrderPaidEvent)
class SendReceiptHandler implements IEventHandler<OrderPaidEvent> {
  // biome-ignore lint/plugin/no-empty-verbs: IEventHandler names the method that @nestjs/cqrs calls
  public handle(): void {
    throw mailDown;
  }
}

export { mailDown, SendReceiptHandler };
