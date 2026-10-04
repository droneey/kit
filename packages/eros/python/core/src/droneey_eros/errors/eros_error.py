from dataclasses import dataclass
from datetime import timedelta
from typing import TYPE_CHECKING, ClassVar

from droneey_eros.constants import CODE_SEGMENT, CODE_SEPARATOR, KINDS

if TYPE_CHECKING:
  from collections.abc import Mapping

  from droneey_eros.constants import Category, ErrorKind


@dataclass(frozen=True, slots=True, kw_only=True)
class ErrorMeta:
  """The public names in an error's code, `[<module>/<entity>/]<kind>[/<reason>]`.

  Each is a segment in lower kebab case, and the module and the entity come together or not
  at all. Anything else raises ValueError, so a class with such meta fails where it is
  declared. The names are a contract: they change only as one.
  """

  module: str | None = None
  entity: str | None = None
  reason: str | None = None

  def __post_init__(self) -> None:
    for segment in (self.module, self.entity, self.reason):
      if segment is not None and CODE_SEGMENT.fullmatch(segment) is None:
        message = f'A segment of a code is in lower kebab case: {segment!r}.'
        raise ValueError(message)
    if (self.module is None) != (self.entity is None):
      message = 'A module and an entity come together or not at all.'
      raise ValueError(message)


class ErosError(Exception):
  """An error of eros. Abstract: an error is raised as one of the kinds.

  A class names the public parts of its code in the class attribute meta, and the cause is
  the standard one: `raise OrderNotFoundError() from error`. Without a message, the error
  has its kind's default one. A negative retry_after raises ValueError. code replaces the
  code the class builds, for an expected error rebuilt from the code another service sent.
  """

  kind: ClassVar[ErrorKind]
  meta: ClassVar[ErrorMeta] = ErrorMeta()
  message: str
  details: Mapping[str, object] | None
  is_retryable: bool
  retry_after: timedelta | None
  code: str

  def __init__(
    self,
    message: str | None = None,
    *,
    details: Mapping[str, object] | None = None,
    is_retryable: bool | None = None,
    retry_after: timedelta | None = None,
    code: str | None = None,
  ) -> None:
    if not hasattr(type(self), 'kind'):
      message = f'{type(self).__name__} is abstract: raise one of the kinds.'
      raise TypeError(message)
    if retry_after is not None and retry_after < timedelta(0):
      message = f'A retry delay is not negative: {retry_after}.'
      raise ValueError(message)
    traits = KINDS[self.kind]
    self.message = traits.message if message is None else message
    super().__init__(self.message)
    self.details = details
    self.is_retryable = traits.is_retryable if is_retryable is None else is_retryable
    self.retry_after = retry_after
    self.code = _build_code(self.kind, self.meta) if code is None else code

  @property
  def title(self) -> str:
    return KINDS[self.kind].title

  @property
  def category(self) -> Category:
    return KINDS[self.kind].category


def _build_code(kind: str, meta: ErrorMeta) -> str:
  segments = (meta.module, meta.entity, kind, meta.reason)
  return CODE_SEPARATOR.join(segment for segment in segments if segment is not None)
