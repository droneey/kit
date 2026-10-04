from dataclasses import dataclass


@dataclass(frozen=True, slots=True, kw_only=True)
class CodeParts:
  """The parts of a code as parse_code reads them, unchecked."""

  kind: str
  module: str | None = None
  entity: str | None = None
  reason: str | None = None
