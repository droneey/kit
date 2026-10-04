import { ErrorKind } from '../constants';
import type { ErosError, ErosErrorInput, ValidationFailure } from '../errors';
import {
  ConflictError,
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
} from '../errors';

interface BuildInput extends ErosErrorInput {
  readonly errors?: readonly ValidationFailure[];
}

type BuildableErrorClass = new (input: BuildInput) => ErosError;

const KIND_CLASSES: Readonly<Record<ErrorKind, BuildableErrorClass>> = {
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

const kindNamed = (name: string): ErrorKind => {
  const kind = Object.values(ErrorKind).find((candidate) => candidate === name);

  if (kind === undefined) {
    throw new Error(`The fixture names an unknown kind: ${name}`);
  }

  return kind;
};

/** The kind whose class the error is an instance of, as the fixtures compare it. */
const kindOf = (error: unknown): ErrorKind | undefined =>
  Object.values(ErrorKind).find((kind) => error instanceof KIND_CLASSES[kind]);

export type { BuildableErrorClass, BuildInput };
export { KIND_CLASSES, kindNamed, kindOf };
