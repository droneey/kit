from typing import TypeGuard

from droneey_eros.errors import ExpectedError


def has_code(error: object, code: str) -> TypeGuard[ExpectedError]:
  """Whether the error is an expected one with this code.

  The way to catch another module's errors and those that came over the network; isinstance
  is fine for a feature's own.
  """
  return isinstance(error, ExpectedError) and error.code == code
