from typing import TYPE_CHECKING

if TYPE_CHECKING:
  from droneey_eros import ErrorRecord


def without_stacks(record: ErrorRecord) -> dict[str, object]:
  """The record with the stack of each error of its chain left out: a stack names this machine."""
  stripped: dict[str, object] = {key: member for key, member in record.items() if key != 'stack'}
  cause = record.get('cause')
  if cause is not None:
    stripped['cause'] = without_stacks(cause)
  return stripped
