from droneey_eros.constants import CODE_SEPARATOR
from droneey_eros.types import CodeParts


def parse_code(code: str) -> CodeParts | None:
  """The parts of a code, read by the number of its segments.

  One is the kind; two are the kind and the reason; three are the module, the entity and the
  kind; four add the reason. It checks neither the kind nor the spelling, gives None for an
  empty segment or a count outside 1 to 4, and never raises.
  """
  segments = code.split(CODE_SEPARATOR)
  if '' in segments:
    return None
  match segments:
    case [kind]:
      return CodeParts(kind=kind)
    case [kind, reason]:
      return CodeParts(kind=kind, reason=reason)
    case [module, entity, kind]:
      return CodeParts(module=module, entity=entity, kind=kind)
    case [module, entity, kind, reason]:
      return CodeParts(module=module, entity=entity, kind=kind, reason=reason)
  return None
