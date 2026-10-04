from datetime import timedelta
from typing import Final

from droneey_eros import KINDS, ExpectedError, ValidationError
from droneey_eros_wire.constants import BLANK_TYPE, PROJECTIONS
from droneey_eros_wire.types import Problem, ProblemFailure

from .projection_utils import to_http_status

_MASKED_KIND: Final = 'internal'


def to_problem(
  error: BaseException,
  *,
  trace_id: str | None = None,
  type_base: str | None = None,
) -> Problem:
  """The RFC 9457 body of an error; an error that is not expected is masked.

  type is `about:blank`, or `<type_base>/<code>` given a type_base. retryAfterSeconds is the
  error's retry_after in whole seconds rounded up, and an empty trace_id is left out.
  """
  problem = (
    _expected_problem(error, type_base)
    if isinstance(error, ExpectedError)
    else _masked_problem(type_base)
  )
  if trace_id:
    problem['traceId'] = trace_id
  return problem


def _expected_problem(error: ExpectedError, type_base: str | None) -> Problem:
  problem = Problem(
    type=_type_of(error.code, type_base),
    title=error.title,
    status=to_http_status(error),
    detail=error.message,
    code=error.code,
    isRetryable=error.is_retryable,
  )
  if error.retry_after is not None:
    problem['retryAfterSeconds'] = _whole_seconds_up(error.retry_after)
  if isinstance(error, ValidationError):
    problem['errors'] = [
      ProblemFailure(pointer=failure.pointer, code=failure.code, detail=failure.detail)
      for failure in error.errors
    ]
  return problem


def _masked_problem(type_base: str | None) -> Problem:
  traits = KINDS[_MASKED_KIND]
  return Problem(
    type=_type_of(_MASKED_KIND, type_base),
    title=traits.title,
    status=PROJECTIONS[_MASKED_KIND].http,
    detail=traits.message,
    code=_MASKED_KIND,
    isRetryable=traits.is_retryable,
  )


def _type_of(code: str, type_base: str | None) -> str:
  return BLANK_TYPE if type_base is None else f'{type_base}/{code}'


def _whole_seconds_up(duration: timedelta) -> int:
  # divmod, since negating the longest timedelta overflows.
  seconds, rest = divmod(duration, timedelta(seconds=1))
  return seconds + (rest > timedelta(0))
