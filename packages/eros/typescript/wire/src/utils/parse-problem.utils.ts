import type { ErosError, ExpectedError, ExpectedKind, ValidationFailure } from '@droneey/eros';
import {
  ConflictError,
  ErrorKind,
  ExpiredError,
  ForbiddenError,
  isPointer,
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

import { PROJECTIONS } from '../constants';
import { recoverFrom } from './recover.utils';

/** The part of a fetch `Response` the parser reads. */
interface FetchResponse {
  readonly status: number;
  readonly text: () => Promise<string>;
}

interface ProblemBody {
  readonly code: string;
  readonly detail: string;
  readonly errors?: unknown;
  readonly isRetryable?: unknown;
  readonly retryAfterSeconds?: unknown;
}

interface ParsedErrorInput {
  readonly errors?: readonly ValidationFailure[];
  readonly isRetryable?: boolean;
  readonly message: string;
  readonly retryAfter?: Temporal.Duration;
}

type ParsedErrorClass = new (code: string, input: ParsedErrorInput) => ExpectedError;

const CLIENT_ERROR_CLASS = 4;
const STATUSES_PER_CLASS = 100;

// The code came over the wire and is kept as it is, even outside the format of eros.
const withCodeFromBody = (Kind: new (input: ParsedErrorInput) => ExpectedError): ParsedErrorClass =>
  class extends Kind {
    public override readonly code: string;

    public constructor(code: string, input: ParsedErrorInput) {
      super(input);
      this.name = Kind.name;
      this.code = code;
    }
  };

const PARSED_ERRORS: Readonly<Record<ExpectedKind, ParsedErrorClass>> = {
  [ErrorKind.Validation]: withCodeFromBody(ValidationError),
  [ErrorKind.Unauthorized]: withCodeFromBody(UnauthorizedError),
  [ErrorKind.Forbidden]: withCodeFromBody(ForbiddenError),
  [ErrorKind.NotFound]: withCodeFromBody(NotFoundError),
  [ErrorKind.Conflict]: withCodeFromBody(ConflictError),
  [ErrorKind.Expired]: withCodeFromBody(ExpiredError),
  [ErrorKind.PayloadTooLarge]: withCodeFromBody(PayloadTooLargeError),
  [ErrorKind.Violation]: withCodeFromBody(ViolationError),
  [ErrorKind.RateLimited]: withCodeFromBody(RateLimitedError),
  [ErrorKind.Unavailable]: withCodeFromBody(UnavailableError),
  [ErrorKind.Timeout]: withCodeFromBody(TimeoutError),
};

const KINDS_BY_STATUS: ReadonlyMap<number, ErrorKind> = new Map(
  Object.values(ErrorKind).map(
    (kind) =>
      [
        PROJECTIONS[kind].http,
        kind,
      ] as const,
  ),
);

const isObject = (body: unknown): body is object =>
  typeof body === 'object' && body !== null && !Array.isArray(body);

const isProblemBody = (body: unknown): body is ProblemBody =>
  isObject(body) &&
  'code' in body &&
  typeof body.code === 'string' &&
  body.code !== '' &&
  'detail' in body &&
  typeof body.detail === 'string';

// A failure whose pointer is not a JSON Pointer would make the ValidationError refuse it.
const isValidationFailure = (failure: unknown): failure is ValidationFailure =>
  isObject(failure) &&
  'pointer' in failure &&
  isPointer(failure.pointer) &&
  'code' in failure &&
  typeof failure.code === 'string' &&
  'detail' in failure &&
  typeof failure.detail === 'string';

const isWholeSeconds = (seconds: unknown): seconds is number =>
  Number.isSafeInteger(seconds) && Number(seconds) >= 0;

const kindOf = (status: number): ErrorKind | undefined =>
  KINDS_BY_STATUS.get(status) ??
  (Math.floor(status / STATUSES_PER_CLASS) === CLIENT_ERROR_CLASS
    ? ErrorKind.Violation
    : undefined);

const inputOf = (body: ProblemBody): ParsedErrorInput => ({
  message: body.detail,
  ...(typeof body.isRetryable === 'boolean'
    ? {
        isRetryable: body.isRetryable,
      }
    : {}),
  ...(isWholeSeconds(body.retryAfterSeconds)
    ? {
        retryAfter: Temporal.Duration.from({
          seconds: body.retryAfterSeconds,
        }),
      }
    : {}),
  // Only a ValidationError reads its errors; the other kinds leave them out.
  errors: Array.isArray(body.errors) ? body.errors.filter(isValidationFailure) : [],
});

/**
 * Turns a response back into an error. A status of the kinds gives its kind; another 4xx gives a
 * ViolationError with the body's code; anything else, or a body that is not a problem, gives an
 * UnexpectedError whose details hold the status and the body. It never throws.
 */
const parseProblem = (status: number, body: unknown): ErosError => {
  const kind = kindOf(status);

  if (kind === undefined || !isProblemBody(body)) {
    return new UnexpectedError({
      message: `Unexpected response with status ${String(status)}.`,
      details: {
        status,
        body,
      },
    });
  }

  if (kind === ErrorKind.Internal) {
    return new UnexpectedError({
      message: body.detail,
    });
  }

  return new PARSED_ERRORS[kind](body.code, inputOf(body));
};

const bodyOf = (text: string): unknown =>
  recoverFrom(
    SyntaxError,
    (): unknown => JSON.parse(text),
    () => text,
  );

/**
 * `parseProblem` for a fetch `Response`: its text is the body, as JSON when it parses. A body that
 * cannot be read gives an UnexpectedError whose details hold the status and whose cause is the
 * failure of the read.
 */
const parseProblemResponse = (response: FetchResponse): Promise<ErosError> =>
  response.text().then(
    (text) => parseProblem(response.status, bodyOf(text)),
    (cause: unknown) =>
      new UnexpectedError({
        message: `Unreadable response with status ${String(response.status)}.`,
        details: {
          status: response.status,
        },
        cause,
      }),
  );

export type { FetchResponse };
export { parseProblem, parseProblemResponse };
