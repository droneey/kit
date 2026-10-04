from typing import TYPE_CHECKING, NotRequired, TypedDict

if TYPE_CHECKING:
  from droneey_eros.constants import Category


class ErosRecord(TypedDict):
  """An error of eros, unmasked: the log sees what the client does not."""

  code: str
  module: NotRequired[str]
  entity: NotRequired[str]
  kind: str
  reason: NotRequired[str]
  category: Category
  title: str
  message: str
  isRetryable: bool
  details: NotRequired[dict[str, object]]
  stack: NotRequired[str]
  cause: NotRequired[ErrorRecord]


class ForeignRecord(TypedDict):
  """An error that is not of eros: Python's own or a vendor's."""

  name: str
  message: str
  stack: NotRequired[str]
  cause: NotRequired[ErrorRecord]


type ErrorRecord = ErosRecord | ForeignRecord
"""The plain object a log writes of an error: common/spec/error-record.schema.json."""
