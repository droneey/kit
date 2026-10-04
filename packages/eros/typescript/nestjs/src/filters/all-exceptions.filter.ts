import { toProblem } from '@droneey/eros-wire';
import type { ArgumentsHost, ExceptionFilter, HttpServer } from '@nestjs/common';
import { Catch } from '@nestjs/common';

import { PROBLEM_MEDIA_TYPE } from '../constants';
import type { HttpExceptionKinds, OnError, ProblemWiring } from '../types';
import { reportError, toErosError } from '../utils';

interface AllExceptionsFilterInput extends ProblemWiring {
  /** The application's adapter, `app.getHttpAdapter()`, so the filter answers through no one platform's response. */
  readonly httpAdapter: HttpServer;
  /** The kinds Nest's exceptions become by their status; without it, every one is masked. */
  readonly httpExceptions?: HttpExceptionKinds;
  readonly onError?: OnError;
}

/** The one handler of HTTP: every exception leaves as an RFC 9457 problem, and is reported once. */
@Catch()
class AllExceptionsFilter implements ExceptionFilter {
  private readonly input: AllExceptionsFilterInput;

  public constructor(input: AllExceptionsFilterInput) {
    this.input = input;
  }

  public catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter, httpExceptions, onError, getTraceId, typeBase } = this.input;
    const error = toErosError(exception, httpExceptions);
    const response: unknown = host.switchToHttp().getResponse();

    reportError(error, onError);

    // A response that has begun cannot take a status or a body any more, so it only ends.
    if (httpAdapter.isHeadersSent(response)) {
      httpAdapter.end(response);

      return;
    }

    const problem = toProblem(error, {
      traceId: getTraceId?.(host),
      typeBase,
    });

    httpAdapter.setHeader(response, 'Content-Type', PROBLEM_MEDIA_TYPE);

    if (problem.retryAfterSeconds !== undefined) {
      httpAdapter.setHeader(response, 'Retry-After', String(problem.retryAfterSeconds));
    }

    httpAdapter.reply(response, problem, problem.status);
  }
}

export type { AllExceptionsFilterInput };
export { AllExceptionsFilter };
