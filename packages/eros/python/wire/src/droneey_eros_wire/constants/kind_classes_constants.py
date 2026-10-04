from types import MappingProxyType
from typing import TYPE_CHECKING, Final

from droneey_eros import (
  ConflictError,
  ExpiredError,
  ForbiddenError,
  NotFoundError,
  PayloadTooLargeError,
  RateLimitedError,
  TimeoutError,  # noqa: A004 -- the class of the kind timeout
  UnauthorizedError,
  UnavailableError,
  UnexpectedError,
  ValidationError,
  ViolationError,
)

if TYPE_CHECKING:
  from collections.abc import Mapping

  from droneey_eros import ErosError, ErrorKind

# The class of each kind, which an error the wire stands for is built as.
KIND_CLASSES: Final[Mapping[ErrorKind, type[ErosError]]] = MappingProxyType(
  {
    'validation': ValidationError,
    'unauthorized': UnauthorizedError,
    'forbidden': ForbiddenError,
    'not-found': NotFoundError,
    'conflict': ConflictError,
    'expired': ExpiredError,
    'payload-too-large': PayloadTooLargeError,
    'violation': ViolationError,
    'rate-limited': RateLimitedError,
    'unavailable': UnavailableError,
    'timeout': TimeoutError,
    'internal': UnexpectedError,
  }
)
