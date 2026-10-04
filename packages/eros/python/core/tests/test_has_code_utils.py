import pytest

from droneey_eros import ErrorMeta, NotFoundError, UnexpectedError, has_code


class OrderNotFoundError(NotFoundError):
  meta = ErrorMeta(module='orders', entity='order')


@pytest.mark.parametrize(
  ('error', 'expected'),
  [
    pytest.param(OrderNotFoundError(), True, id='should match when an expected error has the code'),
    pytest.param(NotFoundError(), False, id='should not match when the code is another'),
    pytest.param(
      NotFoundError(code='orders/order/not-found'),
      True,
      id='should match when another service sent the code',
    ),
    pytest.param(UnexpectedError(), False, id='should not match when the error is unexpected'),
    pytest.param(
      LookupError('orders/order/not-found'),
      False,
      id='should not match when the error is not of eros',
    ),
  ],
)
def test_should_tell_whether_the_error_has_the_code(
  error: BaseException, *, expected: bool
) -> None:
  # Arrange
  # Act
  matches = has_code(error, 'orders/order/not-found')

  # Assert
  assert matches is expected
