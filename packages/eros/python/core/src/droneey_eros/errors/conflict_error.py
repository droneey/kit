from .expected_error import ExpectedError


class ConflictError(ExpectedError):
  """The request clashes with the current state."""

  kind = 'conflict'
