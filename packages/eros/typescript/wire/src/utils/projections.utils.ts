import { ErosError, ErrorKind, KINDS } from '@droneey/eros';

import type { ExitCode, GrpcStatus, HttpStatus, McpOutcome, Projection } from '../constants';
import { PROJECTIONS, QueueDisposition } from '../constants';

// The kind's class sets the kind, so a subclass projects as its kind; anything else is internal.
const projectionOf = (error: unknown): Projection =>
  PROJECTIONS[error instanceof ErosError ? error.kind : ErrorKind.Internal];

const toHttpStatus = (error: unknown): HttpStatus => projectionOf(error).http;

const toGrpcStatus = (error: unknown): GrpcStatus => projectionOf(error).grpc;

/** `tool-error` for an expected error, `internal-error`, masked, for any other. */
const toMcpOutcome = (error: unknown): McpOutcome => projectionOf(error).mcp;

const toExitCode = (error: unknown): ExitCode => projectionOf(error).exitCode;

/**
 * The kind's disposition, unless the error's `isRetryable` differs from its kind's default: then
 * `retry` when it is true, and `dead-letter` when it is false.
 */
const toQueueDisposition = (error: unknown): QueueDisposition => {
  if (error instanceof ErosError && error.isRetryable !== KINDS[error.kind].isRetryable) {
    return error.isRetryable ? QueueDisposition.Retry : QueueDisposition.DeadLetter;
  }

  return projectionOf(error).queue;
};

export { toExitCode, toGrpcStatus, toHttpStatus, toMcpOutcome, toQueueDisposition };
