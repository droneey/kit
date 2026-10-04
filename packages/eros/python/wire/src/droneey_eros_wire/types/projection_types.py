from dataclasses import dataclass
from typing import Literal

type GrpcStatus = Literal[
  'INVALID_ARGUMENT',
  'UNAUTHENTICATED',
  'PERMISSION_DENIED',
  'NOT_FOUND',
  'ABORTED',
  'FAILED_PRECONDITION',
  'RESOURCE_EXHAUSTED',
  'UNAVAILABLE',
  'DEADLINE_EXCEEDED',
  'INTERNAL',
]
"""The name of a gRPC status code."""

type McpOutcome = Literal['tool-error', 'internal-error']
"""A tool result with isError and the problem, or a masked JSON-RPC error -32603."""

type QueueDisposition = Literal[
  'retry', 'retry-if-idempotent', 'dead-letter', 'dead-letter-and-alert'
]
"""What a consumer does with the message whose handling failed."""


@dataclass(frozen=True, slots=True, kw_only=True)
class KindProjection:
  """A kind's row of the projections of kinds.yaml: how it shows on each transport."""

  http: int
  grpc: GrpcStatus
  mcp: McpOutcome
  exit_code: int
  queue: QueueDisposition
