from typing import TYPE_CHECKING

from fastapi.exceptions import RequestValidationError
from starlette.exceptions import (
  HTTPException,  # noqa: TID251 -- the handlers answer the one FastAPI raises
)

from droneey_eros import (
  ErosError,
  ErrorKind,
  UnexpectedError,
  ValidationError,
  ValidationFailure,
  to_pointer,
)
from droneey_eros_wire import KIND_CLASSES

if TYPE_CHECKING:
  from collections.abc import Mapping


def to_eros_error(
  error: Exception, *, http_exceptions: Mapping[int, ErrorKind] | None
) -> ErosError:
  """The error of eros a handler answers for; a translated error has error as its `__cause__`.

  An error of eros stays as it is. A RequestValidationError is a ValidationError with a JSON
  Pointer per failure, whose cause is the RequestValidationError rebuilt without the values
  it rejected, so the log never sees them. An HTTPException whose status http_exceptions
  holds is an error of that kind with its default message; only its status is read.
  Anything else is unexpected.
  """
  if isinstance(error, ErosError):
    return error
  if isinstance(error, RequestValidationError):
    return _validation_of(error)
  kinds = http_exceptions or {}
  if isinstance(error, HTTPException) and error.status_code in kinds:
    translated: ErosError = KIND_CLASSES[kinds[error.status_code]]()
  else:
    translated = UnexpectedError()
  translated.__cause__ = error
  return translated


def _validation_of(error: RequestValidationError) -> ValidationError:
  failures = [
    {key: value for key, value in failure.items() if key != 'input'} for failure in error.errors()
  ]
  translated = ValidationError(errors=[_failure_of(failure) for failure in failures])
  translated.__cause__ = RequestValidationError(failures, endpoint_ctx=error.endpoint_ctx)
  return translated


def _failure_of(failure: Mapping[str, object]) -> ValidationFailure:
  """A failure of pydantic as FastAPI gives it: its loc, type and msg.

  A body member is pointed at from the root, `#/items/0/quantity`; a parameter carries its
  location, `#/query/limit`; a body that is not JSON is `#`. The type becomes the code in
  lower kebab case: `int-parsing`.
  """
  code = str(failure.get('type', '')).replace('_', '-')
  location = failure.get('loc')
  tokens = (
    [token for token in location if isinstance(token, str | int)]
    if isinstance(location, tuple)
    else []
  )
  # A body that is not JSON fails as a whole; its loc ends at a character offset.
  if code == 'json-invalid':
    tokens = []
  elif tokens[:1] == ['body']:
    tokens = tokens[1:]
  return ValidationFailure(
    pointer=to_pointer(tokens), code=code, detail=str(failure.get('msg', ''))
  )
