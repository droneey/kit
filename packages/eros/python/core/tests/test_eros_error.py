import re
from datetime import timedelta
from functools import partial

import pytest

from core_descriptor_fixtures import declare_error
from droneey_eros import (
  ErosError,
  ErrorMeta,
  ExpectedError,
  NotFoundError,
  RateLimitedError,
  UnexpectedError,
  ValidationError,
  ValidationFailure,
)


def observed(error: ErosError) -> dict[str, object]:
  """What a caller reads of an error."""
  return {
    'kind': error.kind,
    'code': error.code,
    'title': error.title,
    'category': error.category,
    'message': error.message,
    'text': str(error),
    'details': error.details,
    'is_retryable': error.is_retryable,
    'retry_after': error.retry_after,
  }


@pytest.mark.parametrize(
  ('abstract', 'message'),
  [
    pytest.param(
      ErosError,
      'ErosError is abstract: raise one of the kinds.',
      id='should refuse to build an error when the class is ErosError',
    ),
    pytest.param(
      ExpectedError,
      'ExpectedError is abstract: raise one of the kinds.',
      id='should refuse to build an error when the class is ExpectedError',
    ),
  ],
)
def test_should_refuse_to_build_an_abstract_class(abstract: type[ErosError], message: str) -> None:
  # Arrange
  # Act
  act = partial(abstract)

  # Assert
  with pytest.raises(TypeError, match=f'^{re.escape(message)}$'):
    act()


@pytest.mark.parametrize(
  ('meta', 'message'),
  [
    pytest.param(
      {'module': 'Orders', 'entity': 'order'},
      "A segment of a code is in lower kebab case: 'Orders'.",
      id='should refuse a segment that is not in lower kebab case',
    ),
    pytest.param(
      {'module': 'orders'},
      'A module and an entity come together or not at all.',
      id='should refuse a module without an entity',
    ),
  ],
)
def test_should_refuse_meta_that_breaks_the_code(meta: dict[str, str], message: str) -> None:
  # Arrange
  # Act
  act = partial(ErrorMeta, **meta)

  # Assert
  with pytest.raises(ValueError, match=f'^{re.escape(message)}$'):
    act()


def test_should_refuse_a_negative_retry_delay() -> None:
  # Arrange
  # Act
  act = partial(RateLimitedError, retry_after=timedelta(seconds=-1))

  # Assert
  with pytest.raises(
    ValueError, match=f'^{re.escape("A retry delay is not negative: -1 day, 23:59:59.")}$'
  ):
    act()


def test_should_keep_a_retry_delay_of_zero() -> None:
  # Arrange
  # Act
  error = RateLimitedError(retry_after=timedelta(0))

  # Assert
  assert observed(error) == {
    'kind': 'rate-limited',
    'code': 'rate-limited',
    'title': 'Too Many Requests',
    'category': 'expected',
    'message': 'Too many requests.',
    'text': 'Too many requests.',
    'details': None,
    'is_retryable': True,
    'retry_after': timedelta(0),
  }


def test_should_refuse_a_failure_that_points_without_a_json_pointer() -> None:
  # Arrange
  # Act
  act = partial(ValidationFailure, pointer='email', code='required', detail='is required')

  # Assert
  with pytest.raises(
    ValueError,
    match=f'^{re.escape("A failure points at its member with a JSON Pointer: 'email'.")}$',
  ):
    act()


def test_should_give_the_kinds_traits_when_it_sets_nothing() -> None:
  # Arrange
  # Act
  error = RateLimitedError()

  # Assert
  assert observed(error) == {
    'kind': 'rate-limited',
    'code': 'rate-limited',
    'title': 'Too Many Requests',
    'category': 'expected',
    'message': 'Too many requests.',
    'text': 'Too many requests.',
    'details': None,
    'is_retryable': True,
    'retry_after': None,
  }


def test_should_keep_what_it_is_given() -> None:
  # Arrange
  # Act
  error = RateLimitedError(
    'Slow down.', details={'limit': 10}, is_retryable=False, retry_after=timedelta(seconds=3)
  )

  # Assert
  assert observed(error) == {
    'kind': 'rate-limited',
    'code': 'rate-limited',
    'title': 'Too Many Requests',
    'category': 'expected',
    'message': 'Slow down.',
    'text': 'Slow down.',
    'details': {'limit': 10},
    'is_retryable': False,
    'retry_after': timedelta(seconds=3),
  }


def test_should_be_unexpected_with_the_masked_traits() -> None:
  # Arrange
  # Act
  error = UnexpectedError('Order 42 has no items.')

  # Assert
  assert observed(error) == {
    'kind': 'internal',
    'code': 'internal',
    'title': 'Internal Server Error',
    'category': 'unexpected',
    'message': 'Order 42 has no items.',
    'text': 'Order 42 has no items.',
    'details': None,
    'is_retryable': False,
    'retry_after': None,
  }


def test_should_declare_a_subclass_of_unexpected_error_without_meta() -> None:
  # Arrange
  class StripeRefusedError(UnexpectedError):
    pass

  # Act
  error = StripeRefusedError()

  # Assert
  assert observed(error) == {
    'kind': 'internal',
    'code': 'internal',
    'title': 'Internal Server Error',
    'category': 'unexpected',
    'message': 'An unexpected error occurred.',
    'text': 'An unexpected error occurred.',
    'details': None,
    'is_retryable': False,
    'retry_after': None,
  }


def test_should_refuse_a_subclass_of_unexpected_error_with_meta() -> None:
  # Arrange
  meta = ErrorMeta(module='orders', entity='order')

  # Act
  act = partial(declare_error, UnexpectedError, meta, name='OrderBrokenError')

  # Assert
  with pytest.raises(
    TypeError,
    match=f'^{re.escape("OrderBrokenError has the code internal alone: it takes no meta.")}$',
  ):
    act()


def test_should_keep_the_failures_of_a_validation_as_its_errors_and_details() -> None:
  # Arrange
  failure = ValidationFailure(pointer='#/email', code='required', detail='is required')

  # Act
  error = ValidationError(errors=[failure])

  # Assert
  assert (error.errors, observed(error)) == (
    (ValidationFailure(pointer='#/email', code='required', detail='is required'),),
    {
      'kind': 'validation',
      'code': 'validation',
      'title': 'Bad Request',
      'category': 'expected',
      'message': 'Validation failed.',
      'text': 'Validation failed.',
      'details': {'errors': [{'pointer': '#/email', 'code': 'required', 'detail': 'is required'}]},
      'is_retryable': False,
      'retry_after': None,
    },
  )


def test_should_keep_the_retry_options_and_the_code_a_validation_is_given() -> None:
  # Arrange
  # Act
  error = ValidationError(
    is_retryable=True, retry_after=timedelta(seconds=5), code='orders/order/validation'
  )

  # Assert
  assert (error.errors, observed(error)) == (
    (),
    {
      'kind': 'validation',
      'code': 'orders/order/validation',
      'title': 'Bad Request',
      'category': 'expected',
      'message': 'Validation failed.',
      'text': 'Validation failed.',
      'details': {'errors': []},
      'is_retryable': True,
      'retry_after': timedelta(seconds=5),
    },
  )


def test_should_keep_the_details_of_an_unexpected_error() -> None:
  # Arrange
  # Act
  error = UnexpectedError(details={'orderId': 42})

  # Assert
  assert observed(error) == {
    'kind': 'internal',
    'code': 'internal',
    'title': 'Internal Server Error',
    'category': 'unexpected',
    'message': 'An unexpected error occurred.',
    'text': 'An unexpected error occurred.',
    'details': {'orderId': 42},
    'is_retryable': False,
    'retry_after': None,
  }


def test_should_take_the_kind_of_its_ancestor() -> None:
  # Arrange
  class OrderNotFoundError(NotFoundError):
    meta = ErrorMeta(module='orders', entity='order', reason='archived')

  # Act
  error = OrderNotFoundError()

  # Assert
  assert observed(error) == {
    'kind': 'not-found',
    'code': 'orders/order/not-found/archived',
    'title': 'Not Found',
    'category': 'expected',
    'message': 'Resource not found.',
    'text': 'Resource not found.',
    'details': None,
    'is_retryable': False,
    'retry_after': None,
  }
