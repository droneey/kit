import traceback

from droneey_eros.errors import ErosError
from droneey_eros.types import ErosRecord, ErrorRecord, ForeignRecord

from .code_utils import parse_code


def to_record(error: BaseException) -> ErrorRecord:
  """The record a log writes of an error, unmasked, with its chain of `__cause__`.

  An error of eros gives its code and the code's parts; a foreign one its name and message.
  stack is present once the error has been raised. A repeated cause ends the chain.
  """
  return _record_of(error, seen=frozenset())


def _record_of(error: BaseException, *, seen: frozenset[int]) -> ErrorRecord:
  record = _eros_record(error) if isinstance(error, ErosError) else _foreign_record(error)
  if error.__traceback__ is not None:
    record['stack'] = ''.join(traceback.format_exception(error, chain=False))
  cause = error.__cause__
  seen_with_error = seen | {id(error)}
  if cause is not None and id(cause) not in seen_with_error:
    record['cause'] = _record_of(cause, seen=seen_with_error)
  return record


def _eros_record(error: ErosError) -> ErosRecord:
  record = ErosRecord(
    code=error.code,
    kind=error.kind,
    category=error.category,
    title=error.title,
    message=error.message,
    isRetryable=error.is_retryable,
  )
  # A code another service sent may not be in the format; its parts then stay out.
  parts = parse_code(error.code)
  if parts is not None and parts.kind == error.kind:
    if parts.module is not None and parts.entity is not None:
      record['module'] = parts.module
      record['entity'] = parts.entity
    if parts.reason is not None:
      record['reason'] = parts.reason
  if error.details is not None:
    record['details'] = dict(error.details)
  return record


def _foreign_record(error: BaseException) -> ForeignRecord:
  return ForeignRecord(name=type(error).__name__, message=str(error))
