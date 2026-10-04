from .expected_error import ExpectedError


class RateLimitedError(ExpectedError):
  """The client sent too many requests; a retry later may succeed."""

  kind = 'rate-limited'
