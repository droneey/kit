from dataclasses import dataclass
from typing import TYPE_CHECKING

from droneey_eros.constants import FRAGMENT_POINTER

from .expected_error import ExpectedError

if TYPE_CHECKING:
  from collections.abc import Iterable
  from datetime import timedelta


@dataclass(frozen=True, slots=True, kw_only=True)
class ValidationFailure:
  """One member that failed validation.

  pointer is an RFC 6901 JSON Pointer in URI fragment form, `#/items/0/quantity`; any other
  raises ValueError. code says what the member failed, in lower kebab case: `invalid-format`.
  """

  pointer: str
  code: str
  detail: str

  def __post_init__(self) -> None:
    if FRAGMENT_POINTER.fullmatch(self.pointer) is None:
      message = f'A failure points at its member with a JSON Pointer: {self.pointer!r}.'
      raise ValueError(message)


class ValidationError(ExpectedError):
  """The request breaks its contract: a format, a type, a required member.

  Its details are `{'errors': [...]}`, one plain item per failure, and the problem carries
  them as `errors`.
  """

  kind = 'validation'
  errors: tuple[ValidationFailure, ...]

  def __init__(
    self,
    message: str | None = None,
    *,
    errors: Iterable[ValidationFailure] = (),
    is_retryable: bool | None = None,
    retry_after: timedelta | None = None,
    code: str | None = None,
  ) -> None:
    self.errors = tuple(errors)
    items = [
      {'pointer': failure.pointer, 'code': failure.code, 'detail': failure.detail}
      for failure in self.errors
    ]
    super().__init__(
      message,
      details={'errors': items},
      is_retryable=is_retryable,
      retry_after=retry_after,
      code=code,
    )
