import pytest

from core_descriptor_fixtures import (
  DescriptorBuilder,
  FixtureCase,
  Json,
  as_object,
  load_cases,
  name_of,
  to_json,
)
from droneey_eros import ErrorRecord, NotFoundError, UnexpectedError, to_record


def without_stacks(record: Json) -> Json:
  members = as_object(record)
  assert isinstance(members.get('stack', ''), str)
  stripped = {key: member for key, member in members.items() if key != 'stack'}
  if 'cause' in stripped:
    stripped['cause'] = without_stacks(stripped['cause'])
  return stripped


def stack_outline(record: ErrorRecord) -> tuple[str, str, str, int]:
  """The first and the last two lines of a record's stack, and the number of tracebacks in it."""
  lines = record.get('stack', '').splitlines()
  return (lines[0], lines[-2], lines[-1], lines.count('Traceback (most recent call last):'))


def load_order() -> None:
  message = 'the orders are gone'
  raise RuntimeError(message)


def find_order() -> None:
  try:
    load_order()
  except RuntimeError as error:
    raise NotFoundError from error


@pytest.mark.parametrize('case', load_cases('record'), ids=name_of)
def test_should_give_the_record_of_the_fixture(case: FixtureCase) -> None:
  # Arrange
  error = DescriptorBuilder().build(case.given)

  # Act
  record = to_record(error)

  # Assert
  assert without_stacks(to_json(record)) == case.expected


def test_should_give_the_stack_of_the_error_alone_when_it_was_raised_from_a_cause() -> None:
  # Arrange
  with pytest.raises(NotFoundError) as raised:
    find_order()

  # Act
  record = to_record(raised.value)

  # Assert
  assert (without_stacks(to_json(record)), stack_outline(record)) == (
    {
      'code': 'not-found',
      'kind': 'not-found',
      'category': 'expected',
      'title': 'Not Found',
      'message': 'Resource not found.',
      'isRetryable': False,
      'cause': {'name': 'RuntimeError', 'message': 'the orders are gone'},
    },
    (
      'Traceback (most recent call last):',
      '    raise NotFoundError from error',
      'droneey_eros.errors.not_found_error.NotFoundError: Resource not found.',
      1,
    ),
  )


def test_should_end_the_chain_when_a_cause_repeats() -> None:
  # Arrange
  error = UnexpectedError()
  cause = RuntimeError('boom')
  error.__cause__ = cause
  cause.__cause__ = error

  # Act
  record = to_record(error)

  # Assert
  assert record == {
    'code': 'internal',
    'kind': 'internal',
    'category': 'unexpected',
    'title': 'Internal Server Error',
    'message': 'An unexpected error occurred.',
    'isRetryable': False,
    'cause': {'name': 'RuntimeError', 'message': 'boom'},
  }


def test_should_leave_the_parts_out_when_the_code_is_not_in_the_format() -> None:
  # Arrange
  error = NotFoundError(code='ORDERS_ORDER_NOT_FOUND')

  # Act
  record = to_record(error)

  # Assert
  assert record == {
    'code': 'ORDERS_ORDER_NOT_FOUND',
    'kind': 'not-found',
    'category': 'expected',
    'title': 'Not Found',
    'message': 'Resource not found.',
    'isRetryable': False,
  }


def test_should_read_the_parts_from_a_code_another_service_sent() -> None:
  # Arrange
  error = NotFoundError(code='orders/order/not-found/archived')

  # Act
  record = to_record(error)

  # Assert
  assert record == {
    'code': 'orders/order/not-found/archived',
    'module': 'orders',
    'entity': 'order',
    'kind': 'not-found',
    'reason': 'archived',
    'category': 'expected',
    'title': 'Not Found',
    'message': 'Resource not found.',
    'isRetryable': False,
  }
