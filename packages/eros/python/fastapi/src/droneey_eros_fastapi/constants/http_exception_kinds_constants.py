from types import MappingProxyType
from typing import TYPE_CHECKING, Final

from droneey_eros_wire import PROJECTIONS

if TYPE_CHECKING:
  from collections.abc import Mapping

  from droneey_eros import ErrorKind

# The kind each status of the kinds' table stands for, 404 for not-found, which the wiring
# passes to add_error_handlers to translate an HTTPException of that status.
HTTP_EXCEPTION_KINDS: Final[Mapping[int, ErrorKind]] = MappingProxyType(
  {projection.http: kind for kind, projection in PROJECTIONS.items()}
)
