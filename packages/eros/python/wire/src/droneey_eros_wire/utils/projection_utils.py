from typing import TYPE_CHECKING

from droneey_eros import KINDS, ErosError, ErrorKind, ExpectedError
from droneey_eros_wire.constants import PROJECTIONS

if TYPE_CHECKING:
  from droneey_eros_wire.types import GrpcStatus, McpOutcome, QueueDisposition


def to_http_status(error: BaseException) -> int:
  """The HTTP status of the error's kind, found by its class's ancestry; 500 if not of eros."""
  return PROJECTIONS[_kind_of(error)].http


def to_grpc_status(error: BaseException) -> GrpcStatus:
  """The gRPC status of the error's kind; INTERNAL if not of eros."""
  return PROJECTIONS[_kind_of(error)].grpc


def to_exit_code(error: BaseException) -> int:
  """The CLI's exit code of the error's kind, from sysexits; 70 if not of eros."""
  return PROJECTIONS[_kind_of(error)].exit_code


def to_mcp_outcome(error: BaseException) -> McpOutcome:
  """tool-error for an expected error, internal-error for any other."""
  return PROJECTIONS[_kind_of(error)].mcp


def to_queue_disposition(error: BaseException) -> QueueDisposition:
  """What a consumer does with the message whose handling raised the error.

  An expected error whose is_retryable differs from its kind's default goes to retry when it
  is true and to dead-letter when it is false; any other keeps its kind's disposition.
  """
  kind = _kind_of(error)
  if isinstance(error, ExpectedError) and error.is_retryable != KINDS[kind].is_retryable:
    return 'retry' if error.is_retryable else 'dead-letter'
  return PROJECTIONS[kind].queue


def _kind_of(error: BaseException) -> ErrorKind:
  return error.kind if isinstance(error, ErosError) else 'internal'
