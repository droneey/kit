import type { ErosError, ErrorMeta, ValidationFailure } from '@droneey/eros';
import {
  ConflictError,
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

type KindInput = NonNullable<ConstructorParameters<typeof ConflictError>[0]>;

interface BuildInput extends KindInput {
  readonly errors?: readonly ValidationFailure[];
}

type ErrorClass = new (input: BuildInput) => ErosError;

interface ErosDescriptor {
  readonly cause?: Descriptor;
  readonly class?: string;
  readonly details?: {
    readonly errors?: readonly ValidationFailure[];
    readonly [key: string]: unknown;
  };
  readonly isRetryable?: boolean;
  readonly kind: string;
  readonly message?: string;
  readonly meta?: ErrorMeta;
  readonly retryAfterSeconds?: number;
}

interface ForeignDescriptor {
  readonly foreign: {
    readonly cause?: Descriptor;
    readonly message: string;
    readonly name: string;
  };
}

type Descriptor = ErosDescriptor | ForeignDescriptor;

const KIND_CLASSES: Readonly<Record<ErrorKind, ErrorClass>> = {
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

const MILLISECONDS_PER_SECOND = 1000;

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

/** Declares the error class of a feature, as spec §3 shows it: it passes its meta to super. */
const declareClass = (kind: ErrorKind, meta: ErrorMeta): ErrorClass => {
  const Kind = KIND_CLASSES[kind];

  return class extends Kind {
    public constructor(input: BuildInput) {
      super({
        ...input,
        meta,
      });
    }
  };
};

// A validation takes its failures as errors; any other kind takes the details whole.
const detailsOf = ({ details }: ErosDescriptor): BuildInput => {
  if (details === undefined) {
    return {};
  }

  const { errors } = details;

  return errors === undefined
    ? {
        details,
      }
    : {
        errors,
      };
};

const isErrorConstructor = (candidate: unknown): candidate is ErrorConstructor =>
  typeof candidate === 'function' && (candidate === Error || candidate.prototype instanceof Error);

const inputOf = (descriptor: ErosDescriptor): BuildInput => {
  const { message, isRetryable, retryAfterSeconds } = descriptor;

  return {
    ...(message === undefined
      ? {}
      : {
          message,
        }),
    ...detailsOf(descriptor),
    ...(isRetryable === undefined
      ? {}
      : {
          isRetryable,
        }),
    ...(retryAfterSeconds === undefined
      ? {}
      : {
          retryAfter: Temporal.Duration.from({
            milliseconds: Math.round(retryAfterSeconds * MILLISECONDS_PER_SECOND),
          }),
        }),
  };
};

/** Builds an error the fixtures of the transports describe; none of them is refused. */
const buildError = (descriptor: Descriptor): Error => {
  if ('foreign' in descriptor) {
    const { foreign } = descriptor;
    const native: unknown = Reflect.get(globalThis, foreign.name);
    const options =
      foreign.cause === undefined
        ? {}
        : {
            cause: buildError(foreign.cause),
          };

    if (isErrorConstructor(native)) {
      return new native(foreign.message, options);
    }

    const error = new Error(foreign.message, options);

    error.name = foreign.name;

    return error;
  }

  const kind = kindNamed(descriptor.kind);
  const ErrorOfDescriptor =
    descriptor.meta === undefined ? KIND_CLASSES[kind] : declareClass(kind, descriptor.meta);

  return new ErrorOfDescriptor({
    ...inputOf(descriptor),
    ...(descriptor.cause === undefined
      ? {}
      : {
          cause: buildError(descriptor.cause),
        }),
  });
};

export type { Descriptor };
export { buildError, kindOf };
