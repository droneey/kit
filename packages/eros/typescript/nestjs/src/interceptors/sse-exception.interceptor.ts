import type { Problem } from '@droneey/eros-wire';
import { toProblem } from '@droneey/eros-wire';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { SSE_METADATA } from '@nestjs/common/constants';
import type { Reflector } from '@nestjs/core';
import type { Observable } from 'rxjs';
// biome-ignore lint/suspicious/noDeprecatedImports: only switchMap's resultSelector overload is deprecated, and it is not used
import { catchError, isObservable, of, switchMap } from 'rxjs';

import type { HttpExceptionKinds, OnError, ProblemWiring } from '../types';
import { reportError, toErosError } from '../utils';

interface SseExceptionInterceptorInput extends ProblemWiring {
  /** The kinds Nest's exceptions become by their status; without it, every one is masked. */
  readonly httpExceptions?: HttpExceptionKinds;
  readonly onError?: OnError;
  /** Nest's `Reflector`, `app.get(Reflector)`, which reads whether a route is SSE. */
  readonly reflector: Reflector;
}

/** The `MessageEvent` an SSE stream ends with when it fails. */
interface SseErrorEvent {
  readonly data: Problem;
  readonly type: 'error';
}

/**
 * An SSE response has sent its headers before the stream fails, so the exception filter cannot
 * answer: the failure becomes the stream's last event, an `error` that carries the problem.
 */
@Injectable()
class SseExceptionInterceptor implements NestInterceptor {
  private readonly input: SseExceptionInterceptorInput;

  public constructor(input: SseExceptionInterceptorInput) {
    this.input = input;
  }

  private toErrorEvent(thrown: unknown, context: ExecutionContext): Observable<SseErrorEvent> {
    const { httpExceptions, onError, getTraceId, typeBase } = this.input;
    const error = toErosError(thrown, httpExceptions);

    reportError(error, onError);

    return of({
      type: 'error',
      data: toProblem(error, {
        traceId: getTraceId?.(context),
        typeBase,
      }),
    });
  }

  public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const isSse = this.input.reflector.get<unknown>(SSE_METADATA, context.getHandler()) === true;

    if (!isSse) {
      return next.handle();
    }

    const toErrorEvent = (thrown: unknown): Observable<SseErrorEvent> =>
      this.toErrorEvent(thrown, context);

    return next.handle().pipe(
      // A handler that returns a promise of a stream yields the stream itself as its value.
      switchMap((stream: unknown) =>
        isObservable(stream) ? stream.pipe(catchError(toErrorEvent)) : of(stream),
      ),
      catchError(toErrorEvent),
    );
  }
}

export type { SseErrorEvent, SseExceptionInterceptorInput };
export { SseExceptionInterceptor };
