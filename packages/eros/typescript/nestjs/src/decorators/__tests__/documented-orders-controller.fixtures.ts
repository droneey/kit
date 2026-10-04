import { RateLimitedError } from '@droneey/eros';
import { Controller, Get } from '@nestjs/common';

import { OrderNotFoundError } from '../../__tests__/order-not-found-error.fixtures';
import { ApiExpectedErrors } from '../api-expected-errors.decorator';

@Controller('orders')
class DocumentedOrdersController {
  @Get('latest')
  @ApiExpectedErrors(
    new OrderNotFoundError(),
    new RateLimitedError({
      retryAfter: Temporal.Duration.from({
        seconds: 30,
      }),
    }),
  )
  public readLatestOrder(): string {
    return 'order';
  }
}

export { DocumentedOrdersController };
