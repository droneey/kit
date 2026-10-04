import type { ErrorTarget } from '@droneey/eros';
import {
  ConflictError,
  ErosError,
  ErrorKind,
  ExpiredError,
  ForbiddenError,
  NotFoundError,
  PayloadTooLargeError,
  RateLimitedError,
  TimeoutError,
  UnauthorizedError,
  UnavailableError,
  UnexpectedError,
  ValidationError,
  ViolationError,
} from '@droneey/eros';
import { HttpException } from '@nestjs/common';

import type { HttpExceptionKinds } from '../types';

const KIND_CLASSES: Readonly<Record<ErrorKind, ErrorTarget>> = {
  [ErrorKind.Validation]: ValidationError,
  [ErrorKind.Unauthorized]: UnauthorizedError,
  [ErrorKind.Forbidden]: ForbiddenError,
  [ErrorKind.NotFound]: NotFoundError,
  [ErrorKind.Conflict]: ConflictError,
  [ErrorKind.Expired]: ExpiredError,
  [ErrorKind.PayloadTooLarge]: PayloadTooLargeError,
  [ErrorKind.Violation]: ViolationError,
  [ErrorKind.RateLimited]: RateLimitedError,
  [ErrorKind.Unavailable]: UnavailableError,
  [ErrorKind.Timeout]: TimeoutError,
  [ErrorKind.Internal]: UnexpectedError,
};

const NO_KINDS: HttpExceptionKinds = new Map();

/**
 * Gives the error eros answers with: an error of eros as it is; a Nest exception whose status the
 * table holds as an error of that kind, with the kind's own text and code; anything else wrapped in
 * an UnexpectedError. Only the status is read: the exception, with its message, becomes the cause,
 * which the log sees and the client does not.
 */
const toErosError = (thrown: unknown, httpExceptions: HttpExceptionKinds = NO_KINDS): ErosError => {
  if (thrown instanceof ErosError) {
    return thrown;
  }

  const kind = thrown instanceof HttpException ? httpExceptions.get(thrown.getStatus()) : undefined;

  return new KIND_CLASSES[kind ?? ErrorKind.Internal]({
    cause: thrown,
  });
};

export { toErosError };
