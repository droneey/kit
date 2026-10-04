from .expected_error import ExpectedError


class UnavailableError(ExpectedError):
  """A dependency is down, and a retry may succeed.

  A resource that a business rule keeps closed is a ViolationError.
  """

  kind = 'unavailable'
