from typing import TYPE_CHECKING

from yaml import safe_load

from droneey_eros_wire import KIND_CLASSES
from wire_descriptor_fixtures import COMMON, Json, as_object, to_json

if TYPE_CHECKING:
  from collections.abc import Mapping

  from droneey_eros import ErosError, ErrorKind


def spec_classes() -> dict[str, Json]:
  """The class column of kinds.yaml."""
  document = to_json(safe_load((COMMON / 'spec' / 'kinds.yaml').read_text()))
  kinds = as_object(as_object(document)['kinds'])
  return {kind: as_object(traits)['class'] for kind, traits in kinds.items()}


def class_names(kind_classes: Mapping[ErrorKind, type[ErosError]]) -> dict[str, Json]:
  return {kind: kind_class.__name__ for kind, kind_class in kind_classes.items()}


def kinds_of(kind_classes: Mapping[ErrorKind, type[ErosError]]) -> dict[str, Json]:
  return {kind: kind_class.kind for kind, kind_class in kind_classes.items()}


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
