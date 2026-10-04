import re
from functools import partial

import pytest

from core_descriptor_fixtures import (
  FixtureCase,
  as_object,
  as_text,
  build_remap,
  load_cases,
  name_of,
)
from droneey_eros import create_validation_mapper, prefix_validation_fields, to_pointer


def next_line(match: re.Match[str]) -> str:
  """The pointer of the line after the matched item: items count from 0, lines from 1."""
  return f'#/lines/{int(match[1]) + 1}'


@pytest.mark.parametrize('case', load_cases('pointer'), ids=name_of)
def test_should_remap_the_pointer_of_the_fixture(case: FixtureCase) -> None:
  # Arrange
  given = as_object(case.given)
  remap = build_remap(given['remap'])
  pointer = as_text(given['pointer'])

  # Act
  remapped = remap(pointer)

  # Assert
  assert remapped == case.expected


@pytest.mark.parametrize(
  ('path', 'expected'),
  [
    pytest.param([], '#', id='should give the whole document when the path is empty'),
    pytest.param(['items', 0, 'quantity'], '#/items/0/quantity', id='should join the tokens'),
    pytest.param(['a/b', 'c~d'], '#/a~1b/c~0d', id='should escape a slash and a tilde'),
    pytest.param(
      ['a b', 'ü'], '#/a%20b/%C3%BC', id='should percent-encode what a fragment forbids'
    ),
    pytest.param(["it's:@"], "#/it's:@", id='should keep what a fragment allows'),
  ],
)
def test_should_give_the_pointer_of_a_path(path: list[str | int], expected: str) -> None:
  # Arrange
  # Act
  pointer = to_pointer(path)

  # Assert
  assert pointer == expected


def test_should_keep_a_root_member_whose_name_is_percent_encoded() -> None:
  # Arrange
  remap = prefix_validation_fields('#/payload', keep_at_root=['a b'])

  # Act
  remapped = remap('#/a%20b/c')

  # Assert
  assert remapped == '#/a%20b/c'


def test_should_refuse_a_prefix_that_is_not_a_pointer() -> None:
  # Arrange
  # Act
  act = partial(prefix_validation_fields, 'payload')

  # Assert
  with pytest.raises(
    ValueError, match=f'^{re.escape("A prefix is a JSON Pointer like #/payload: 'payload'.")}$'
  ):
    act()


def test_should_replace_by_a_function_of_the_match() -> None:
  # Arrange
  remap = create_validation_mapper([(re.compile(r'^#/items/(\d+)$'), next_line)])

  # Act
  remapped = remap('#/items/0')

  # Assert
  assert remapped == '#/lines/1'


def test_should_replace_only_the_first_match_of_a_regex() -> None:
  # Arrange
  remap = create_validation_mapper([(re.compile(r'items'), 'lines')])

  # Act
  remapped = remap('#/items/0/items')

  # Assert
  assert remapped == '#/lines/0/items'
