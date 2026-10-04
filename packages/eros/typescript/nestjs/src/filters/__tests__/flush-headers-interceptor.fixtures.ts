import type { ServerResponse } from 'node:http';

import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';

/** Sends the headers before the handler runs, as a stream that has begun has. */
class FlushHeadersInterceptor implements NestInterceptor {
  public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    context.switchToHttp().getResponse<ServerResponse>().flushHeaders();

    return next.handle();
  }
}

export { FlushHeadersInterceptor };
