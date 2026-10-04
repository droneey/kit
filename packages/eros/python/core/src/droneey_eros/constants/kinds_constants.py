from dataclasses import dataclass
from types import MappingProxyType
from typing import TYPE_CHECKING, Final, Literal

if TYPE_CHECKING:
  from collections.abc import Mapping

type ErrorKind = Literal[
  'validation',
  'unauthorized',
  'forbidden',
  'not-found',
  'conflict',
  'expired',
  'payload-too-large',
  'violation',
  'rate-limited',
  'unavailable',
  'timeout',
  'internal',
]
"""A kind's id, which is also the kind's segment of a code."""

type Category = Literal['expected', 'unexpected']


@dataclass(frozen=True, slots=True, kw_only=True)
class KindTraits:
  """A kind's row of kinds.yaml: its class, title, default message, retry default and category."""

  class_name: str
  title: str
  message: str
  is_retryable: bool
  category: Category


# The kinds of common/spec/kinds.yaml, which a spec holds this table equal to.
KINDS: Final[Mapping[ErrorKind, KindTraits]] = MappingProxyType(
  {
    'validation': KindTraits(
      class_name='ValidationError',
      title='Bad Request',
      message='Validation failed.',
      is_retryable=False,
      category='expected',
    ),
    'unauthorized': KindTraits(
      class_name='UnauthorizedError',
      title='Unauthorized',
      message='Authentication is required.',
      is_retryable=False,
      category='expected',
    ),
    'forbidden': KindTraits(
      class_name='ForbiddenError',
      title='Forbidden',
      message='Access is forbidden.',
      is_retryable=False,
      category='expected',
    ),
    'not-found': KindTraits(
      class_name='NotFoundError',
      title='Not Found',
      message='Resource not found.',
      is_retryable=False,
      category='expected',
    ),
    'conflict': KindTraits(
      class_name='ConflictError',
      title='Conflict',
      message='Resource conflict.',
      is_retryable=False,
      category='expected',
    ),
    'expired': KindTraits(
      class_name='ExpiredError',
      title='Gone',
      message='Resource expired.',
      is_retryable=False,
      category='expected',
    ),
    'payload-too-large': KindTraits(
      class_name='PayloadTooLargeError',
      title='Content Too Large',
      message='Payload is too large.',
      is_retryable=False,
      category='expected',
    ),
    'violation': KindTraits(
      class_name='ViolationError',
      title='Unprocessable Content',
      message='A business rule was violated.',
      is_retryable=False,
      category='expected',
    ),
    'rate-limited': KindTraits(
      class_name='RateLimitedError',
      title='Too Many Requests',
      message='Too many requests.',
      is_retryable=True,
      category='expected',
    ),
    'unavailable': KindTraits(
      class_name='UnavailableError',
      title='Service Unavailable',
      message='Service is unavailable.',
      is_retryable=True,
      category='expected',
    ),
    'timeout': KindTraits(
      class_name='TimeoutError',
      title='Gateway Timeout',
      message='A dependency did not answer in time.',
      is_retryable=True,
      category='expected',
    ),
    'internal': KindTraits(
      class_name='UnexpectedError',
      title='Internal Server Error',
      message='An unexpected error occurred.',
      is_retryable=False,
      category='unexpected',
    ),
  }
)
