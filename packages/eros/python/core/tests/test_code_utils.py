import re
from functools import partial

import pytest
from hypothesis import given
from hypothesis import strategies as st

from core_descriptor_fixtures import (
  KIND_CLASSES,
  DescriptorBuilder,
  FixtureCase,
  as_object,
  as_text,
  declare_error,
  load_cases,
  name_of,
)
from droneey_eros import CodeParts, ErosError, ErrorMeta, parse_code

# A segment of a code, as common/spec/README.md writes it.
SEGMENTS = st.from_regex(r'[a-z0-9]+(?:-[a-z0-9]+)*', fullmatch=True)
# A kind that takes meta: internal's code is always internal.
KINDS_WITH_META = st.sampled_from([kind for kind in KIND_CLASSES if kind != 'internal'])
METAS = st.builds(ErrorMeta, reason=st.none() | SEGMENTS) | st.builds(
  ErrorMeta, module=SEGMENTS, entity=SEGMENTS, reason=st.none() | SEGMENTS
)

REJECTED = {'isRejected': True}
UNPARSED = {'isUnparsed': True}
CODE_CASES = load_cases('code')
# code.json checks only that an input is refused; these are the messages Python refuses it with.
REFUSALS = {
  'should refuse the error when meta has a module and no entity': (
    'A module and an entity come together or not at all.'
  ),
  'should refuse the error when meta has an entity and no module': (
    'A module and an entity come together or not at all.'
  ),
  'should refuse the error when the module has a capital letter': (
    "A segment of a code is in lower kebab case: 'Orders'."
  ),
  'should refuse the error when the entity has an underscore': (
    "A segment of a code is in lower kebab case: 'promo_code'."
  ),
  'should refuse the error when the reason is in upper case': (
    "A segment of a code is in lower kebab case: 'ALREADY_PAID'."
  ),
  'should refuse the error when the module is an empty string': (
    "A segment of a code is in lower kebab case: ''."
  ),
  'should refuse the error when the reason is an empty string': (
    "A segment of a code is in lower kebab case: ''."
  ),
  'should refuse the error when a segment begins with a hyphen': (
    "A segment of a code is in lower kebab case: '-order'."
  ),
  'should refuse the error when a segment ends with a hyphen': (
    "A segment of a code is in lower kebab case: 'archived-'."
  ),
  'should refuse the error when a segment holds two hyphens in a row': (
    "A segment of a code is in lower kebab case: 'promo--code'."
  ),
  'should refuse the error when a segment holds a slash': (
    "A segment of a code is in lower kebab case: 'already/paid'."
  ),
  'should refuse the error when a segment holds a space': (
    "A segment of a code is in lower kebab case: 'already paid'."
  ),
  'should refuse the error when a segment holds a letter outside ASCII': (
    "A segment of a code is in lower kebab case: 'café'."
  ),
  'should refuse the error when the retry delay is negative': (
    'A retry delay is not negative: -1 day, 23:59:59.'
  ),
  "should refuse the error when a failure's pointer has no hash": (
    "A failure points at its member with a JSON Pointer: '/email'."
  ),
  "should refuse the error when a failure's pointer has no slash after the hash": (
    "A failure points at its member with a JSON Pointer: '#email'."
  ),
  "should refuse the error when a failure's pointer has a tilde that escapes nothing": (
    "A failure points at its member with a JSON Pointer: '#/a~2b'."
  ),
}
BUILT_CASES = [case for case in CODE_CASES if case.expected != REJECTED]
REFUSED_CASES = [
  pytest.param(case, REFUSALS[case.name], id=case.name)
  for case in CODE_CASES
  if case.expected == REJECTED
]


def plain_parts(parts: CodeParts | None) -> dict[str, str | bool]:
  if parts is None:
    return dict(UNPARSED)
  members = {
    'module': parts.module,
    'entity': parts.entity,
    'kind': parts.kind,
    'reason': parts.reason,
  }
  return {key: member for key, member in members.items() if member is not None}


@pytest.mark.parametrize('case', BUILT_CASES, ids=name_of)
def test_should_build_the_code_of_the_fixture(case: FixtureCase) -> None:
  # Arrange
  builder = DescriptorBuilder()

  # Act
  error = builder.build_error(case.given)

  # Assert
  assert {'code': error.code} == case.expected


@pytest.mark.parametrize(('case', 'message'), REFUSED_CASES)
def test_should_refuse_the_input_of_the_fixture(case: FixtureCase, message: str) -> None:
  # Arrange
  builder = DescriptorBuilder()

  # Act
  act = partial(builder.build_error, case.given)

  # Assert
  with pytest.raises(ValueError, match=f'^{re.escape(message)}$'):
    act()


@pytest.mark.parametrize('case', load_cases('parse-code'), ids=name_of)
def test_should_parse_the_code_of_the_fixture(case: FixtureCase) -> None:
  # Arrange
  code = as_text(as_object(case.given)['code'])

  # Act
  parts = parse_code(code)

  # Assert
  assert plain_parts(parts) == case.expected


@given(error_class=KINDS_WITH_META.map(KIND_CLASSES.__getitem__), meta=METAS)
def test_should_parse_back_the_parts_of_every_code_it_builds(
  error_class: type[ErosError], meta: ErrorMeta
) -> None:
  # Arrange
  error = declare_error(error_class, meta)()

  # Act
  parts = parse_code(error.code)

  # Assert
  assert parts == CodeParts(
    module=meta.module, entity=meta.entity, kind=error_class.kind, reason=meta.reason
  )
