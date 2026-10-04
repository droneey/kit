from .expected_error import ExpectedError


class NotFoundError(ExpectedError):
  """What the request names does not exist."""

  kind = 'not-found'
