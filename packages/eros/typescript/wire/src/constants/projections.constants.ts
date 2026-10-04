import { ErrorKind } from '@droneey/eros';

enum HttpStatus {
  BadRequest = 400,
  Unauthorized = 401,
  Forbidden = 403,
  NotFound = 404,
  Conflict = 409,
  Gone = 410,
  ContentTooLarge = 413,
  UnprocessableContent = 422,
  TooManyRequests = 429,
  InternalServerError = 500,
  ServiceUnavailable = 503,
  GatewayTimeout = 504,
}

/** The names of the gRPC status codes eros answers with. */
enum GrpcStatus {
  InvalidArgument = 'INVALID_ARGUMENT',
  Unauthenticated = 'UNAUTHENTICATED',
  PermissionDenied = 'PERMISSION_DENIED',
  NotFound = 'NOT_FOUND',
  Aborted = 'ABORTED',
  FailedPrecondition = 'FAILED_PRECONDITION',
  ResourceExhausted = 'RESOURCE_EXHAUSTED',
  Unavailable = 'UNAVAILABLE',
  DeadlineExceeded = 'DEADLINE_EXCEEDED',
  Internal = 'INTERNAL',
}

enum McpOutcome {
  /** A tool result with `isError: true` and the problem in `structuredContent`. */
  ToolError = 'tool-error',
  /** A masked JSON-RPC error `-32603`. */
  InternalError = 'internal-error',
}

/** The exit codes of sysexits a command line ends with. */
enum ExitCode {
  Usage = 64,
  DataError = 65,
  NoInput = 66,
  Unavailable = 69,
  Software = 70,
  TemporaryFailure = 75,
  NoPermission = 77,
}

/** What a consumer of a queue does with the message that failed. */
enum QueueDisposition {
  Retry = 'retry',
  RetryIfIdempotent = 'retry-if-idempotent',
  DeadLetter = 'dead-letter',
  DeadLetterAndAlert = 'dead-letter-and-alert',
}

/** How a kind shows on each transport, as the projections of `common/spec/kinds.yaml` say. */
interface Projection {
  readonly exitCode: ExitCode;
  readonly grpc: GrpcStatus;
  readonly http: HttpStatus;
  readonly mcp: McpOutcome;
  readonly queue: QueueDisposition;
}

const PROJECTIONS: Readonly<Record<ErrorKind, Projection>> = {
  [ErrorKind.Validation]: {
    http: HttpStatus.BadRequest,
    grpc: GrpcStatus.InvalidArgument,
    mcp: McpOutcome.ToolError,
    exitCode: ExitCode.Usage,
    queue: QueueDisposition.DeadLetter,
  },
  [ErrorKind.Unauthorized]: {
    http: HttpStatus.Unauthorized,
    grpc: GrpcStatus.Unauthenticated,
    mcp: McpOutcome.ToolError,
    exitCode: ExitCode.NoPermission,
    queue: QueueDisposition.DeadLetter,
  },
  [ErrorKind.Forbidden]: {
    http: HttpStatus.Forbidden,
    grpc: GrpcStatus.PermissionDenied,
    mcp: McpOutcome.ToolError,
    exitCode: ExitCode.NoPermission,
    queue: QueueDisposition.DeadLetter,
  },
  [ErrorKind.NotFound]: {
    http: HttpStatus.NotFound,
    grpc: GrpcStatus.NotFound,
    mcp: McpOutcome.ToolError,
    exitCode: ExitCode.NoInput,
    queue: QueueDisposition.DeadLetter,
  },
  [ErrorKind.Conflict]: {
    http: HttpStatus.Conflict,
    grpc: GrpcStatus.Aborted,
    mcp: McpOutcome.ToolError,
    exitCode: ExitCode.DataError,
    queue: QueueDisposition.DeadLetter,
  },
  [ErrorKind.Expired]: {
    http: HttpStatus.Gone,
    grpc: GrpcStatus.FailedPrecondition,
    mcp: McpOutcome.ToolError,
    exitCode: ExitCode.DataError,
    queue: QueueDisposition.DeadLetter,
  },
  [ErrorKind.PayloadTooLarge]: {
    http: HttpStatus.ContentTooLarge,
    grpc: GrpcStatus.ResourceExhausted,
    mcp: McpOutcome.ToolError,
    exitCode: ExitCode.DataError,
    queue: QueueDisposition.DeadLetter,
  },
  [ErrorKind.Violation]: {
    http: HttpStatus.UnprocessableContent,
    grpc: GrpcStatus.FailedPrecondition,
    mcp: McpOutcome.ToolError,
    exitCode: ExitCode.DataError,
    queue: QueueDisposition.DeadLetter,
  },
  [ErrorKind.RateLimited]: {
    http: HttpStatus.TooManyRequests,
    grpc: GrpcStatus.ResourceExhausted,
    mcp: McpOutcome.ToolError,
    exitCode: ExitCode.TemporaryFailure,
    queue: QueueDisposition.Retry,
  },
  [ErrorKind.Unavailable]: {
    http: HttpStatus.ServiceUnavailable,
    grpc: GrpcStatus.Unavailable,
    mcp: McpOutcome.ToolError,
    exitCode: ExitCode.Unavailable,
    queue: QueueDisposition.Retry,
  },
  [ErrorKind.Timeout]: {
    http: HttpStatus.GatewayTimeout,
    grpc: GrpcStatus.DeadlineExceeded,
    mcp: McpOutcome.ToolError,
    exitCode: ExitCode.TemporaryFailure,
    queue: QueueDisposition.RetryIfIdempotent,
  },
  [ErrorKind.Internal]: {
    http: HttpStatus.InternalServerError,
    grpc: GrpcStatus.Internal,
    mcp: McpOutcome.InternalError,
    exitCode: ExitCode.Software,
    queue: QueueDisposition.DeadLetterAndAlert,
  },
};

export type { Projection };
export { ExitCode, GrpcStatus, HttpStatus, McpOutcome, PROJECTIONS, QueueDisposition };
