import { TimeoutError } from '@droneey/eros';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { SSE_METADATA } from '@nestjs/common/constants';
import type { Reflector } from '@nestjs/core';
import type { Observable, SchedulerLike } from 'rxjs';
import { catchError, TimeoutError as RxTimeoutError, timeout } from 'rxjs';

interface TimeoutInterceptorInput {
  /** Nest's `Reflector`, `app.get(Reflector)`, which reads whether a route is SSE. */
  readonly reflector: Reflector;
  /** The clock the timeout runs on; rxjs's `asyncScheduler` when none is given. */
  readonly scheduler?: SchedulerLike;
  /** How long a handler may take before the request fails with a TimeoutError. */
  readonly timeout: Temporal.Duration;
}

/** Fails a request whose handler outlives the timeout; an SSE stream is left to run. */
@Injectable()
class TimeoutInterceptor implements NestInterceptor {
  private readonly reflector: Reflector;
  private readonly scheduler: SchedulerLike | undefined;
  private readonly timeoutMs: number;

  public constructor({ reflector, scheduler, timeout: duration }: TimeoutInterceptorInput) {
    this.reflector = reflector;
    this.scheduler = scheduler;
    this.timeoutMs = duration.total({
      unit: 'milliseconds',
    });
  }

  public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const isSse = this.reflector.get<unknown>(SSE_METADATA, context.getHandler()) === true;

    if (isSse) {
      return next.handle();
    }

    return next.handle().pipe(
      timeout(this.timeoutMs, this.scheduler),
      catchError((error: unknown) => {
        throw error instanceof RxTimeoutError
          ? new TimeoutError({
              cause: error,
            })
          : error;
      }),
    );
  }
}

export type { TimeoutInterceptorInput };
export { TimeoutInterceptor };
