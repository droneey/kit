from .expected_error import ExpectedError


class ExpiredError(ExpectedError):
  """What the request names existed, and is gone for good."""

  kind = 'expired'
