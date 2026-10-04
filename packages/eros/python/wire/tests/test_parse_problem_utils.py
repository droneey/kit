from datetime import timedelta

import pytest
from hypothesis import example, given
from hypothesis import strategies as st

from droneey_eros import ErosError, RateLimitedError
from droneey_eros_wire import KIND_CLASSES, parse_problem, to_problem
from wire_descriptor_fixtures import (
  FixtureCase,
  Json,
  as_int,
  as_kind,
  as_object,
  load_cases,
  name_of,
  problem_body,
  to_json,
)


def build_expected_error(
  *, error_class: type[ErosError], message: str, is_retryable: bool, retry_after: timedelta | None
) -> ErosError:
  return error_class(message, is_retryable=is_retryable, retry_after=retry_after)


def delay_of(seconds: int) -> timedelta:
  return timedelta(seconds=seconds)


# An expected error as a program raises one: a problem carries its retry delay in whole seconds.
EXPECTED_ERRORS = st.builds(
  build_expected_error,
  error_class=st.sampled_from([KIND_CLASSES[kind] for kind in KIND_CLASSES if kind != 'internal']),
  message=st.text(),
  is_retryable=st.booleans(),
  retry_after=st.none()
  | st.integers(min_value=0, max_value=timedelta.max // timedelta(seconds=1)).map(delay_of),
)


def parsed_of(error: ErosError) -> dict[str, Json]:
  parsed: dict[str, Json] = {
    'kind': error.kind,
    'code': error.code,
    'message': error.message,
    'isRetryable': error.is_retryable,
  }
  if error.details is not None:
    parsed['details'] = to_json(error.details)
  if error.retry_after is not None:
    parsed['retryAfterSeconds'] = error.retry_after.total_seconds()
  return parsed


@pytest.mark.parametrize('case', load_cases('parse'), ids=name_of)
def test_should_parse_the_error_of_the_fixture(case: FixtureCase) -> None:
  # Arrange
  given = as_object(case.given)
  status = as_int(given['status'])
  kind_class = KIND_CLASSES[as_kind(as_object(case.expected)['kind'])]

  # Act
  error = parse_problem(status, given['body'])

  # Assert
  assert (type(error), parsed_of(error)) == (kind_class, case.expected)


def test_should_leave_out_a_failure_whose_pointer_is_not_one() -> None:
  # Arrange
  body = problem_body(
    'validation', errors=[{'pointer': '/email', 'code': 'required', 'detail': 'is required'}]
  )

  # Act
  error = parse_problem(400, body)

  # Assert
  assert parsed_of(error) == {
    'kind': 'validation',
    'code': 'validation',
    'message': 'Validation failed.',
    'isRetryable': False,
    'details': {'errors': []},
  }


@pytest.mark.parametrize(
  'seconds',
  [
    pytest.param(float('inf'), id='should leave out a retry delay that is infinite'),
    pytest.param(True, id='should leave out a retry delay that is a boolean'),
    pytest.param(10**15, id='should leave out a retry delay longer than a timedelta holds'),
  ],
)
def test_should_leave_out_a_retry_delay_that_is_not_a_number_of_seconds(seconds: Json) -> None:
  # Arrange
  body = problem_body(retryAfterSeconds=seconds)

  # Act
  error = parse_problem(429, body)

  # Assert
  assert parsed_of(error) == {
    'kind': 'rate-limited',
    'code': 'rate-limited',
    'message': 'Too many requests.',
    'isRetryable': True,
  }


@pytest.mark.parametrize(
  ('seconds', 'expected'),
  [
    pytest.param(
      30.0,
      {
        'kind': 'rate-limited',
        'code': 'rate-limited',
        'message': 'Too many requests.',
        'isRetryable': True,
        'retryAfterSeconds': 30.0,
      },
      id='should read a whole retry delay when it is written as a fraction',
    ),
    pytest.param(
      0,
      {
        'kind': 'rate-limited',
        'code': 'rate-limited',
        'message': 'Too many requests.',
        'isRetryable': True,
        'retryAfterSeconds': 0.0,
      },
      id='should read a retry delay when it is zero',
    ),
  ],
)
def test_should_read_a_whole_retry_delay(seconds: Json, expected: dict[str, Json]) -> None:
  # Arrange
  body = problem_body(retryAfterSeconds=seconds)

  # Act
  error = parse_problem(429, body)

  # Assert
  assert parsed_of(error) == expected


def test_should_ignore_a_member_whose_name_is_not_text() -> None:
  # Arrange
  body = {1: 'one', **problem_body('not-found')}

  # Act
  error = parse_problem(404, body)

  # Assert
  assert parsed_of(error) == {
    'kind': 'not-found',
    'code': 'not-found',
    'message': 'Resource not found.',
    'isRetryable': False,
  }


def test_should_keep_the_detail_of_a_500_as_the_message() -> None:
  # Arrange
  body = problem_body('internal', detail='The ledger is down.')

  # Act
  error = parse_problem(500, body)

  # Assert
  assert parsed_of(error) == {
    'kind': 'internal',
    'code': 'internal',
    'message': 'The ledger is down.',
    'isRetryable': False,
  }


def test_should_give_a_validation_every_member_of_its_body() -> None:
  # Arrange
  body = problem_body(
    'validation',
    detail='The order is invalid.',
    code='orders/order/validation',
    isRetryable=True,
    retryAfterSeconds=5,
    errors=[{'pointer': '#/email', 'code': 'required', 'detail': 'is required'}],
  )

  # Act
  error = parse_problem(400, body)

  # Assert
  assert parsed_of(error) == {
    'kind': 'validation',
    'code': 'orders/order/validation',
    'message': 'The order is invalid.',
    'isRetryable': True,
    'details': {'errors': [{'pointer': '#/email', 'code': 'required', 'detail': 'is required'}]},
    'retryAfterSeconds': 5.0,
  }


@given(error=EXPECTED_ERRORS)
@example(
  error=RateLimitedError(retry_after=timedelta(seconds=timedelta.max // timedelta(seconds=1)))
)
def test_should_parse_back_every_expected_error_it_answers_with(error: ErosError) -> None:
  # Arrange
  problem = to_problem(error)

  # Act
  parsed = parse_problem(problem['status'], problem)

  # Assert
  assert (type(parsed), parsed.code, parsed.message, parsed.is_retryable, parsed.retry_after) == (
    type(error),
    error.code,
    error.message,
    error.is_retryable,
    error.retry_after,
  )
