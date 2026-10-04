import pytest

from droneey_eros_wire import (
  to_exit_code,
  to_grpc_status,
  to_http_status,
  to_mcp_outcome,
  to_queue_disposition,
)
from wire_descriptor_fixtures import DescriptorBuilder, FixtureCase, Json, load_cases, name_of


def projections_of(error: BaseException) -> dict[str, Json]:
  """Every projection of an error, by the names projections.json gives them."""
  return {
    'http': to_http_status(error),
    'grpc': to_grpc_status(error),
    'mcp': to_mcp_outcome(error),
    'exitCode': to_exit_code(error),
    'queue': to_queue_disposition(error),
  }


@pytest.mark.parametrize('case', load_cases('projections'), ids=name_of)
def test_should_give_the_projections_of_the_fixture(case: FixtureCase) -> None:
  # Arrange
  error = DescriptorBuilder().build(case.given)

  # Act
  projections = projections_of(error)

  # Assert
  assert projections == case.expected
