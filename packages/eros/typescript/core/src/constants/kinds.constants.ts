/** Each kind by its id, which is also the kind's segment of a code. */
enum ErrorKind {
  Validation = 'validation',
  Unauthorized = 'unauthorized',
  Forbidden = 'forbidden',
  NotFound = 'not-found',
  Conflict = 'conflict',
  Expired = 'expired',
  PayloadTooLarge = 'payload-too-large',
  Violation = 'violation',
  RateLimited = 'rate-limited',
  Unavailable = 'unavailable',
  Timeout = 'timeout',
  Internal = 'internal',
}

enum ErrorCategory {
  Expected = 'expected',
  Unexpected = 'unexpected',
}

/** A kind as `common/spec/kinds.yaml` describes it. */
interface KindDefinition {
  readonly category: ErrorCategory;
  /** The name of the kind's class. */
  readonly class: string;
  readonly isRetryable: boolean;
  /** The default text, which an error may replace with its own. */
  readonly message: string;
  readonly title: string;
}

const KINDS: Readonly<Record<ErrorKind, KindDefinition>> = {
  [ErrorKind.Validation]: {
    class: 'ValidationError',
    title: 'Bad Request',
    message: 'Validation failed.',
    isRetryable: false,
    category: ErrorCategory.Expected,
  },
  [ErrorKind.Unauthorized]: {
    class: 'UnauthorizedError',
    title: 'Unauthorized',
    message: 'Authentication is required.',
    isRetryable: false,
    category: ErrorCategory.Expected,
  },
  [ErrorKind.Forbidden]: {
    class: 'ForbiddenError',
    title: 'Forbidden',
    message: 'Access is forbidden.',
    isRetryable: false,
    category: ErrorCategory.Expected,
  },
  [ErrorKind.NotFound]: {
    class: 'NotFoundError',
    title: 'Not Found',
    message: 'Resource not found.',
    isRetryable: false,
    category: ErrorCategory.Expected,
  },
  [ErrorKind.Conflict]: {
    class: 'ConflictError',
    title: 'Conflict',
    message: 'Resource conflict.',
    isRetryable: false,
    category: ErrorCategory.Expected,
  },
  [ErrorKind.Expired]: {
    class: 'ExpiredError',
    title: 'Gone',
    message: 'Resource expired.',
    isRetryable: false,
    category: ErrorCategory.Expected,
  },
  [ErrorKind.PayloadTooLarge]: {
    class: 'PayloadTooLargeError',
    title: 'Content Too Large',
    message: 'Payload is too large.',
    isRetryable: false,
    category: ErrorCategory.Expected,
  },
  [ErrorKind.Violation]: {
    class: 'ViolationError',
    title: 'Unprocessable Content',
    message: 'A business rule was violated.',
    isRetryable: false,
    category: ErrorCategory.Expected,
  },
  [ErrorKind.RateLimited]: {
    class: 'RateLimitedError',
    title: 'Too Many Requests',
    message: 'Too many requests.',
    isRetryable: true,
    category: ErrorCategory.Expected,
  },
  [ErrorKind.Unavailable]: {
    class: 'UnavailableError',
    title: 'Service Unavailable',
    message: 'Service is unavailable.',
    isRetryable: true,
    category: ErrorCategory.Expected,
  },
  [ErrorKind.Timeout]: {
    class: 'TimeoutError',
    title: 'Gateway Timeout',
    message: 'A dependency did not answer in time.',
    isRetryable: true,
    category: ErrorCategory.Expected,
  },
  [ErrorKind.Internal]: {
    class: 'UnexpectedError',
    title: 'Internal Server Error',
    message: 'An unexpected error occurred.',
    isRetryable: false,
    category: ErrorCategory.Unexpected,
  },
};

export type { KindDefinition };
export { ErrorCategory, ErrorKind, KINDS };
