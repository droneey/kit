from types import MappingProxyType
from typing import TYPE_CHECKING, Final

from droneey_eros_wire.types import KindProjection

if TYPE_CHECKING:
  from collections.abc import Mapping

  from droneey_eros import ErrorKind

# The projections of common/spec/kinds.yaml, which a spec holds this table equal to.
PROJECTIONS: Final[Mapping[ErrorKind, KindProjection]] = MappingProxyType(
  {
    'validation': KindProjection(
      http=400, grpc='INVALID_ARGUMENT', mcp='tool-error', exit_code=64, queue='dead-letter'
    ),
    'unauthorized': KindProjection(
      http=401, grpc='UNAUTHENTICATED', mcp='tool-error', exit_code=77, queue='dead-letter'
    ),
    'forbidden': KindProjection(
      http=403, grpc='PERMISSION_DENIED', mcp='tool-error', exit_code=77, queue='dead-letter'
    ),
    'not-found': KindProjection(
      http=404, grpc='NOT_FOUND', mcp='tool-error', exit_code=66, queue='dead-letter'
    ),
    'conflict': KindProjection(
      http=409, grpc='ABORTED', mcp='tool-error', exit_code=65, queue='dead-letter'
    ),
    'expired': KindProjection(
      http=410, grpc='FAILED_PRECONDITION', mcp='tool-error', exit_code=65, queue='dead-letter'
    ),
    'payload-too-large': KindProjection(
      http=413, grpc='RESOURCE_EXHAUSTED', mcp='tool-error', exit_code=65, queue='dead-letter'
    ),
    'violation': KindProjection(
      http=422, grpc='FAILED_PRECONDITION', mcp='tool-error', exit_code=65, queue='dead-letter'
    ),
    'rate-limited': KindProjection(
      http=429, grpc='RESOURCE_EXHAUSTED', mcp='tool-error', exit_code=75, queue='retry'
    ),
    'unavailable': KindProjection(
      http=503, grpc='UNAVAILABLE', mcp='tool-error', exit_code=69, queue='retry'
    ),
    'timeout': KindProjection(
      http=504,
      grpc='DEADLINE_EXCEEDED',
      mcp='tool-error',
      exit_code=75,
      queue='retry-if-idempotent',
    ),
    'internal': KindProjection(
      http=500, grpc='INTERNAL', mcp='internal-error', exit_code=70, queue='dead-letter-and-alert'
    ),
  }
)
