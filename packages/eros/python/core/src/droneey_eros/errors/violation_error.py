from .expected_error import ExpectedError


class ViolationError(ExpectedError):
  """The request is well formed, but a business invariant says no.

  A reason in meta is welcome, `orders/order/violation/already-paid`, and optional.
  """

  kind = 'violation'
