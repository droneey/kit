import type { ArgumentsHost } from '@nestjs/common';

/** How a boundary builds the problem: the trace it reads from the request, and the base of each type. */
interface ProblemWiring {
  /** Reads the current request's trace for the problem's `traceId`. */
  readonly getTraceId?: (host: ArgumentsHost) => string | undefined;
  /** Makes the type `<typeBase>/<code>` instead of `about:blank`. */
  readonly typeBase?: string;
}

export type { ProblemWiring };
