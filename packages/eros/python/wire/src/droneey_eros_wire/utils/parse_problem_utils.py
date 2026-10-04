import math
from dataclasses import dataclass
from datetime import timedelta
from types import MappingProxyType
from typing import TYPE_CHECKING, Final

from droneey_eros import (
  ErosError,
  ErrorKind,
  UnexpectedError,
  ValidationError,
  ValidationFailure,
)
from droneey_eros_wire.constants import KIND_CLASSES, PROJECTIONS

if TYPE_CHECKING:
  from collections.abc import Mapping

_KINDS_BY_STATUS: Final[Mapping[int, ErrorKind]] = MappingProxyType(
  {projection.http: kind for kind, projection in PROJECTIONS.items()}
)
_STATUSES_PER_CLASS: Final = 100
_CLIENT_ERROR_CLASS: Final = 4


@dataclass(frozen=True, slots=True, kw_only=True)
class _ProblemMembers:
  code: str
  detail: str
  is_retryable: bool | None
  retry_after: timedelta | None
  errors: tuple[ValidationFailure, ...]


def parse_problem(status: int, body: object) -> ErosError:
  """The error a response stands for: the inverse of to_problem.

  A status of the kinds' table gives its kind; another 4xx gives a ViolationError. Either
  keeps the body's code as it is. Any other status, or a body that is not a problem, gives
  an UnexpectedError whose details hold the status and the body. A body is a problem when
  its code and detail are strings and the code is not empty, and a member of the wrong type
  is ignored as if it were absent. Only a ValidationError reads errors.
  """
  members = _read_problem(body)
  kind = _KINDS_BY_STATUS.get(status)
  if kind is None and status // _STATUSES_PER_CLASS == _CLIENT_ERROR_CLASS:
    kind = 'violation'
  if members is None or kind is None:
    return UnexpectedError(
      f'Unexpected response with status {status}.',
      details={'status': status, 'body': body},
    )
  if kind == 'internal':
    return UnexpectedError(members.detail)
  if kind == 'validation':
    return ValidationError(
      members.detail,
      errors=members.errors,
      is_retryable=members.is_retryable,
      retry_after=members.retry_after,
      code=members.code,
    )
  return KIND_CLASSES[kind](
    members.detail,
    is_retryable=members.is_retryable,
    retry_after=members.retry_after,
    code=members.code,
  )


def _read_problem(body: object) -> _ProblemMembers | None:
  if not isinstance(body, dict):
    return None
  members = _string_keyed(body)
  code = members.get('code')
  detail = members.get('detail')
  if not isinstance(code, str) or not code or not isinstance(detail, str):
    return None
  is_retryable = members.get('isRetryable')
  return _ProblemMembers(
    code=code,
    detail=detail,
    is_retryable=is_retryable if isinstance(is_retryable, bool) else None,
    retry_after=_read_duration(members.get('retryAfterSeconds')),
    errors=_read_failures(members.get('errors')),
  )


def _read_duration(seconds: object) -> timedelta | None:
  if isinstance(seconds, bool) or not isinstance(seconds, int | float):
    return None
  if not math.isfinite(seconds) or seconds < 0 or seconds != int(seconds):
    return None
  # A delay longer than a timedelta holds is a member of the wrong type: parsing never raises.
  try:
    duration = timedelta(seconds=int(seconds))
  except OverflowError:
    return None
  return duration


def _read_failures(errors: object) -> tuple[ValidationFailure, ...]:
  if not isinstance(errors, list):
    return ()
  failures = (_read_failure(item) for item in errors)
  return tuple(failure for failure in failures if failure is not None)


def _read_failure(item: object) -> ValidationFailure | None:
  if not isinstance(item, dict):
    return None
  members = _string_keyed(item)
  pointer = members.get('pointer')
  code = members.get('code')
  detail = members.get('detail')
  if not isinstance(pointer, str) or not isinstance(code, str) or not isinstance(detail, str):
    return None
  # A pointer that is not one is a member of the wrong type, and parsing never raises.
  try:
    failure = ValidationFailure(pointer=pointer, code=code, detail=detail)
  except ValueError:
    return None
  return failure


def _string_keyed(members: dict[object, object]) -> dict[str, object]:
  return {key: member for key, member in members.items() if isinstance(key, str)}
