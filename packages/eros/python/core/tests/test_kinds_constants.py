from typing import TYPE_CHECKING

from yaml import safe_load

from core_descriptor_fixtures import COMMON, KIND_CLASSES, Json, as_object, to_json
from droneey_eros import KINDS

if TYPE_CHECKING:
  from collections.abc import Mapping

  from droneey_eros import ErosError, ErrorKind, KindTraits


def spec_kinds() -> dict[str, Json]:
  document = to_json(safe_load((COMMON / 'spec' / 'kinds.yaml').read_text()))
  return as_object(as_object(document)['kinds'])


def spec_classes() -> dict[str, Json]:
  """The class column of kinds.yaml."""
  return {kind: as_object(traits)['class'] for kind, traits in spec_kinds().items()}


def plain_kinds(kinds: Mapping[ErrorKind, KindTraits]) -> dict[str, Json]:
  return {
    kind: {
      'class': traits.class_name,
      'title': traits.title,
      'message': traits.message,
      'isRetryable': traits.is_retryable,
      'category': traits.category,
    }
    for kind, traits in kinds.items()
  }


def class_names(kind_classes: Mapping[ErrorKind, type[ErosError]]) -> dict[str, Json]:
  return {kind: kind_class.__name__ for kind, kind_class in kind_classes.items()}


def kinds_of(kind_classes: Mapping[ErrorKind, type[ErosError]]) -> dict[str, Json]:
  return {kind: kind_class.kind for kind, kind_class in kind_classes.items()}


def test_should_hold_the_kinds_of_the_spec() -> None:
  # Arrange
  spec = spec_kinds()

  # Act
  kinds = plain_kinds(KINDS)

  # Assert
  assert kinds == spec


def test_should_name_each_kinds_class_as_the_spec_does() -> None:
  # Arrange
  spec = spec_classes()

  # Act
  names = class_names(KIND_CLASSES)

  # Assert
  assert names == spec


def test_should_give_each_class_the_kind_it_stands_for() -> None:
  # Arrange
  # Act
  kinds = kinds_of(KIND_CLASSES)

  # Assert
  assert kinds == {
    'validation': 'validation',
    'unauthorized': 'unauthorized',
    'forbidden': 'forbidden',
    'not-found': 'not-found',
    'conflict': 'conflict',
    'expired': 'expired',
    'payload-too-large': 'payload-too-large',
    'violation': 'violation',
    'rate-limited': 'rate-limited',
    'unavailable': 'unavailable',
    'timeout': 'timeout',
    'internal': 'internal',
  }
