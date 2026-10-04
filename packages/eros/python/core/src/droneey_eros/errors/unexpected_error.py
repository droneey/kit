from typing import TYPE_CHECKING

from .eros_error import ErosError, ErrorMeta

if TYPE_CHECKING:
  from collections.abc import Mapping


class UnexpectedError(ErosError):
  """A bug, or a state that cannot be: the client gets a masked 500 and a person is woken.

  Its code is always internal and it is never retryable, so a subclass declaring meta raises
  TypeError.
  """

  kind = 'internal'

  def __init_subclass__(cls) -> None:
    super().__init_subclass__()
    if cls.meta != ErrorMeta():
      message = f'{cls.__name__} has the code internal alone: it takes no meta.'
      raise TypeError(message)

  def __init__(
    self,
    message: str | None = None,
    *,
    details: Mapping[str, object] | None = None,
  ) -> None:
    super().__init__(message, details=details)
