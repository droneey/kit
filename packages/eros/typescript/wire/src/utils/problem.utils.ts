import type { ValidationFailure } from '@droneey/eros';
import { ExpectedError, UnexpectedError, ValidationError } from '@droneey/eros';

import type { HttpStatus } from '../constants';
import { toHttpStatus } from './projections.utils';

/** The RFC 9457 body a client receives, as `application/problem+json`. */
interface Problem {
  readonly code: string;
  readonly detail: string;
  readonly errors?: readonly ValidationFailure[];
  readonly isRetryable: boolean;
  readonly retryAfterSeconds?: number;
  readonly status: HttpStatus;
  readonly title: string;
  readonly traceId?: string;
  readonly type: string;
}

interface ToProblemInput {
  /** The trace of the current request; the body carries it unless it is empty. */
  readonly traceId?: string | undefined;
  /** Makes the type `<typeBase>/<code>` instead of `about:blank`. */
  readonly typeBase?: string | undefined;
}

const typeOf = (code: string, typeBase: string | undefined): string =>
  typeBase === undefined ? 'about:blank' : `${typeBase}/${code}`;

/**
 * The problem body of an error. An unexpected error, and anything not of eros, is masked: no cause,
 * stack or vendor text leaves. Only a validation's failures reach the body, as `errors`.
 */
const toProblem = (error: unknown, { traceId, typeBase }: ToProblemInput = {}): Problem => {
  const shown = error instanceof ExpectedError ? error : new UnexpectedError();

  return {
    type: typeOf(shown.code, typeBase),
    title: shown.title,
    status: toHttpStatus(shown),
    detail: shown.message,
    code: shown.code,
    isRetryable: shown.isRetryable,
    ...(shown.retryAfter === undefined
      ? {}
      : {
          retryAfterSeconds: Math.ceil(
            shown.retryAfter.total({
              unit: 'seconds',
            }),
          ),
        }),
    ...(shown instanceof ValidationError
      ? {
          errors: shown.details.errors,
        }
      : {}),
    ...(traceId === undefined || traceId === ''
      ? {}
      : {
          traceId,
        }),
  };
};

export type { Problem, ToProblemInput };
export { toProblem };
