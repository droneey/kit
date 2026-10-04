from datetime import timedelta

import pytest

from droneey_eros import RateLimitedError
from droneey_eros_wire import to_problem
from wire_descriptor_fixtures import (
  DescriptorBuilder,
  FixtureCase,
  as_object,
  as_optional_text,
  load_cases,
  name_of,
)


@pytest.mark.parametrize('case', load_cases('problem'), ids=name_of)
def test_should_give_the_problem_of_the_fixture(case: FixtureCase) -> None:
  # Arrange
  given = as_object(case.given)
  error = DescriptorBuilder().build(given['error'])
  trace_id = as_optional_text(given.get('traceId'))
  type_base = as_optional_text(given.get('typeBase'))

  # Act
  problem = to_problem(error, trace_id=trace_id, type_base=type_base)

  # Assert
  assert problem == case.expected


def test_should_round_up_the_longest_retry_delay_a_timedelta_holds() -> None:
  # Arrange
  error = RateLimitedError(retry_after=timedelta.max)

  # Act
  problem = to_problem(error)

  # Assert
  assert problem == {
    'type': 'about:blank',
    'title': 'Too Many Requests',
    'status': 429,
    'detail': 'Too many requests.',
    'code': 'rate-limited',
    'isRetryable': True,
    'retryAfterSeconds': 86_400_000_000_000,
  }
