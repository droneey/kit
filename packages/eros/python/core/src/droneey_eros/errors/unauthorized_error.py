from .expected_error import ExpectedError


class UnauthorizedError(ExpectedError):
  """The client did not prove who it is."""

  kind = 'unauthorized'
