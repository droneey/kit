from collections.abc import Callable
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
  from droneey_eros.errors import ErosError

  from .error_record_types import ErrorRecord


@dataclass(frozen=True, slots=True, kw_only=True)
class ErrorEvent:
  """What an adapter gives its on_error hook, to log the error once.

  error is always of eros: an adapter wraps a foreign error in an UnexpectedError whose
  `__cause__` it is. The event holds no log level: the logger chooses it.
  """

  error: ErosError
  record: ErrorRecord


type OnError = Callable[[ErrorEvent], None]
