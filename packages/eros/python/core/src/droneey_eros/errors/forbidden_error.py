from .expected_error import ExpectedError


class ForbiddenError(ExpectedError):
  """The client may not do this."""

  kind = 'forbidden'
