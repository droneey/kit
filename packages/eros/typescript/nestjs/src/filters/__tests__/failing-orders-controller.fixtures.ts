import { RateLimitedError, ValidationError } from '@droneey/eros';
import {
  BadRequestException,
  ConflictException,
  Controller,
  Get,
  HttpException,
  UseInterceptors,
} from '@nestjs/common';

import { OrderNotFoundError } from '../../__tests__/order-not-found-error.fixtures';
import { FlushHeadersInterceptor } from './flush-headers-interceptor.fixtures';

const orderNotFound = new OrderNotFoundError();
const ledgerBroken = new TypeError('ledger.entries is undefined');
const orderChanged = new ConflictException('The order changed.');

@Controller('orders')
class FailingOrdersController {
  @Get('missing')
  public readMissingOrder(): never {
    throw orderNotFound;
  }

  @Get('broken')
  public readBrokenOrder(): never {
    throw ledgerBroken;
  }

  @Get('busy')
  public readBusyOrder(): never {
    throw new RateLimitedError({
      retryAfter: Temporal.Duration.from({
        milliseconds: 1500,
      }),
    });
  }

  @Get('throttled')
  public readThrottledOrder(): never {
    throw new HttpException('Too Many Requests', 429);
  }

  @Get('invalid')
  public readInvalidOrder(): never {
    throw new ValidationError({
      errors: [
        {
          pointer: '#/items/0/quantity',
          code: 'invalid-format',
          detail: 'must be a positive integer',
        },
      ],
    });
  }

  @Get('malformed')
  public readMalformedOrder(): never {
    throw new BadRequestException();
  }

  @Get('changed')
  public readChangedOrder(): never {
    throw orderChanged;
  }

  @Get('streamed')
  @UseInterceptors(FlushHeadersInterceptor)
  public readStreamedOrder(): never {
    throw orderNotFound;
  }
}

export { FailingOrdersController, ledgerBroken, orderChanged, orderNotFound };
