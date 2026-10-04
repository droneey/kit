from typing import TYPE_CHECKING

from yaml import safe_load

from droneey_eros_wire import PROJECTIONS
from wire_descriptor_fixtures import COMMON, Json, as_object, to_json

if TYPE_CHECKING:
  from collections.abc import Mapping

  from droneey_eros import ErrorKind
  from droneey_eros_wire import KindProjection


def spec_projections() -> dict[str, Json]:
  document = to_json(safe_load((COMMON / 'spec' / 'kinds.yaml').read_text()))
  return as_object(as_object(document)['projections'])


def plain_projections(projections: Mapping[ErrorKind, KindProjection]) -> dict[str, Json]:
  return {
    kind: {
      'http': projection.http,
      'grpc': projection.grpc,
      'mcp': projection.mcp,
      'exitCode': projection.exit_code,
      'queue': projection.queue,
    }
    for kind, projection in projections.items()
  }


def test_should_hold_the_projections_of_the_spec() -> None:
  # Arrange
  spec = spec_projections()

  # Act
  projections = plain_projections(PROJECTIONS)

  # Assert
  assert projections == spec
