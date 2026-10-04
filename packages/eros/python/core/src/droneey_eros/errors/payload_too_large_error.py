from .expected_error import ExpectedError


class PayloadTooLargeError(ExpectedError):
  """The request is larger than the program takes."""

  kind = 'payload-too-large'
