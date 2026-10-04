from typing import TYPE_CHECKING
from urllib.parse import quote, unquote

from droneey_eros.constants import FRAGMENT_POINTER

if TYPE_CHECKING:
  from collections.abc import Collection, Sequence

  from droneey_eros.types import PointerRemap, ValidationRule

# RFC 3986 lets a fragment keep these besides the unreserved characters; `/` is safe
# because each token has already escaped its own as `~1`.
_FRAGMENT_SAFE = "!$&'()*+,;=:@/?"


def to_pointer(path: Sequence[str | int]) -> str:
  """The RFC 6901 JSON Pointer of a path, in URI fragment form: `#/items/0/name`.

  An empty path is the whole document, `#`.
  """
  tokens = (str(part).replace('~', '~0').replace('/', '~1') for part in path)
  return '#' + ''.join('/' + quote(token, safe=_FRAGMENT_SAFE) for token in tokens)


def prefix_validation_fields(prefix: str, *, keep_at_root: Collection[str] = ()) -> PointerRemap:
  """Moves each pointer under prefix: `#/x` becomes `#/strategyPayload/x`.

  prefix is a pointer in URI fragment form; any other raises ValueError. keep_at_root holds
  the unescaped names of root members that stay where they are, with everything under them.
  """
  if FRAGMENT_POINTER.fullmatch(prefix) is None:
    message = f'A prefix is a JSON Pointer like #/payload: {prefix!r}.'
    raise ValueError(message)
  kept_members = frozenset(keep_at_root)

  def prefix_pointer(pointer: str) -> str:
    if _root_member_of(pointer) in kept_members:
      return pointer
    return prefix + pointer.removeprefix('#')

  return prefix_pointer


def create_validation_mapper(rules: Sequence[ValidationRule]) -> PointerRemap:
  """Rewrites a pointer by the first rule that matches it, or leaves it unchanged.

  A string matches only a pointer equal to it; a regex replaces its first match.
  """

  def remap_pointer(pointer: str) -> str:
    for rule in rules:
      remapped = _apply_rule(rule, pointer)
      if remapped is not None:
        return remapped
    return pointer

  return remap_pointer


def _root_member_of(pointer: str) -> str | None:
  if not pointer.startswith('#/'):
    return None
  token = pointer.removeprefix('#/').partition('/')[0]
  # RFC 6901: decode the fragment's percent escapes first, then ~1, then ~0.
  return unquote(token).replace('~1', '/').replace('~0', '~')


def _apply_rule(rule: ValidationRule, pointer: str) -> str | None:
  match rule:
    case (str() as exact, str() as replacement):
      return replacement if pointer == exact else None
    case _:
      pattern, replacement = rule
      remapped, count = pattern.subn(replacement, pointer, count=1)
      return remapped if count > 0 else None
