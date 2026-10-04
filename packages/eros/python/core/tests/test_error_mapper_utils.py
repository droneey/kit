import re
from functools import partial

import pytest

from core_descriptor_fixtures import (
  DescriptorBuilder,
  FixtureCase,
  Json,
  as_object,
  as_text,
  load_cases,
  name_of,
  to_json,
)
from droneey_eros import (
  ErosError,
  NotFoundError,
  ValidationError,
  ValidationFailure,
  create_error_mapper,
  prefix_validation_fields,
)

# Python raises only exceptions, so a thrown value that is not one cannot occur.
MAP_CASES = [
  case for case in load_cases('map') if 'thrown' not in as_object(as_object(case.given)['error'])
]
RETHROWING_CASES = [case for case in MAP_CASES if as_object(case.expected)['throws'] == 'input']
RAISING_CASES = [case for case in MAP_CASES if as_object(case.expected)['throws'] != 'input']


def outcome_of(
  raised: ErosError, *, error: BaseException, expected: Json, builder: DescriptorBuilder
) -> dict[str, Json]:
  """What map.json compares of a new error: its class when named, its details when given."""
  wanted = as_object(expected)
  outcome: dict[str, Json] = {
    'kind': raised.kind,
    'code': raised.code,
    'cause': 'input' if raised.__cause__ is error else repr(raised.__cause__),
  }
  if 'class' in wanted:
    named_class = builder.classes[as_text(wanted['class'])]
    outcome['class'] = wanted['class'] if isinstance(raised, named_class) else repr(type(raised))
  if 'details' in wanted:
    outcome['details'] = to_json(raised.details)
  return outcome


@pytest.mark.parametrize('case', RETHROWING_CASES, ids=name_of)
def test_should_rethrow_the_input_of_the_fixture(case: FixtureCase) -> None:
  # Arrange
  builder = DescriptorBuilder()
  given = as_object(case.given)
  map_error = builder.build_mapper(given['mapper'])
  error = builder.build_exception(given['error'])

  # Act
  act = partial(map_error, error)

  # Assert
  with pytest.raises(type(error)) as raised:
    act()
  assert raised.value is error


@pytest.mark.parametrize('case', RAISING_CASES, ids=name_of)
def test_should_raise_the_new_error_of_the_fixture(case: FixtureCase) -> None:
  # Arrange
  builder = DescriptorBuilder()
  given = as_object(case.given)
  map_error = builder.build_mapper(given['mapper'])
  error = builder.build_exception(given['error'])
  expected = as_object(case.expected)['throws']

  # Act
  act = partial(map_error, error)

  # Assert
  with pytest.raises(ErosError) as raised:
    act()
  assert outcome_of(raised.value, error=error, expected=expected, builder=builder) == expected


def test_should_keep_the_message_when_it_remaps_a_validation_error() -> None:
  # Arrange
  map_error = create_error_mapper(
    mode='transparent', validation_mapper=prefix_validation_fields('#/outer')
  )
  failure = ValidationFailure(pointer='#/email', code='required', detail='is required')
  error = ValidationError('The order is incomplete.', errors=[failure])

  # Act
  act = partial(map_error, error)

  # Assert
  with pytest.raises(ValidationError, match=f'^{re.escape("The order is incomplete.")}$') as raised:
    act()
  assert raised.value.errors == (
    ValidationFailure(pointer='#/outer/email', code='required', detail='is required'),
  )


def test_should_build_the_target_with_its_kinds_default_message() -> None:
  # Arrange
  class SourceNotFoundError(NotFoundError):
    pass

  map_error = create_error_mapper(mode='expected', mappings=[(SourceNotFoundError, NotFoundError)])
  error = SourceNotFoundError('Source 42 not found.')

  # Act
  act = partial(map_error, error)

  # Assert
  with pytest.raises(NotFoundError, match=f'^{re.escape("Resource not found.")}$'):
    act()
