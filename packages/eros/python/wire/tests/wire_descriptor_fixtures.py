"""The cases of common/fixtures and the errors their descriptors stand for, as its README says."""

import builtins
import json
from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path

from droneey_eros import (
  KINDS,
  ErosError,
  ErrorKind,
  ErrorMeta,
  UnexpectedError,
  ValidationError,
  ValidationFailure,
)
from droneey_eros_wire import BLANK_TYPE, KIND_CLASSES, PROJECTIONS

# The product's common/, the nearest above the spec: mutmut runs a copy of tests/ in mutants/.
COMMON = next(
  folder / 'common' for folder in Path(__file__).parents if (folder / 'common' / 'spec').is_dir()
)

type Json = bool | int | float | str | list[Json] | dict[str, Json] | None


@dataclass(frozen=True, slots=True, kw_only=True)
class FixtureCase:
  name: str
  given: Json
  expected: Json


def to_json(value: object) -> Json:
  """A parsed JSON or YAML value, checked member by member."""
  if value is None or isinstance(value, bool | int | float | str):
    return value
  if isinstance(value, list):
    return [to_json(item) for item in value]
  if isinstance(value, dict):
    return {str(key): to_json(item) for key, item in value.items()}
  message = f'Not a JSON value: {value!r}.'
  raise TypeError(message)


def as_object(value: Json) -> dict[str, Json]:
  assert isinstance(value, dict)
  return value


def as_list(value: Json) -> list[Json]:
  assert isinstance(value, list)
  return value


def as_text(value: Json) -> str:
  assert isinstance(value, str)
  return value


def as_optional_text(value: Json) -> str | None:
  return None if value is None else as_text(value)


def as_optional_flag(value: Json) -> bool | None:
  assert value is None or isinstance(value, bool)
  return value


def as_kind(value: Json) -> ErrorKind:
  for kind in KINDS:
    if kind == value:
      return kind
  message = f'Not a kind of eros: {value!r}.'
  raise ValueError(message)


def as_int(value: Json) -> int:
  assert isinstance(value, int)
  return value


def problem_body(kind: ErrorKind = 'rate-limited', **overrides: Json) -> dict[str, Json]:
  """A valid problem of the kind, as to_problem answers with one, with the overrides."""
  traits = KINDS[kind]
  return {
    'type': BLANK_TYPE,
    'title': traits.title,
    'status': PROJECTIONS[kind].http,
    'detail': traits.message,
    'code': kind,
    'isRetryable': traits.is_retryable,
    **overrides,
  }


def load_cases(operation: str) -> list[FixtureCase]:
  document = as_object(to_json(json.loads((COMMON / 'fixtures' / f'{operation}.json').read_text())))
  assert document['operation'] == operation
  return [
    FixtureCase(
      name=as_text(case['name']),
      given=case['input'],
      expected=case['expected'],
    )
    for case in map(as_object, as_list(document['cases']))
  ]


def name_of(case: FixtureCase) -> str:
  return case.name


class DescriptorBuilder:
  """Builds the errors of one case, declaring each named class once."""

  def __init__(self) -> None:
    self.classes: dict[str, type[ErosError]] = {}

  def build(self, descriptor: Json) -> BaseException:
    members = as_object(descriptor)
    if 'foreign' in members:
      return self.build_foreign(members['foreign'])
    return self.build_error(members)

  def build_foreign(self, descriptor: Json) -> BaseException:
    members = as_object(descriptor)
    name = as_text(members['name'])
    builtin = getattr(builtins, name, None)
    if isinstance(builtin, type) and issubclass(builtin, BaseException):
      foreign_class: type[BaseException] = builtin
    else:
      foreign_class = type(name, (Exception,), {})
    error = foreign_class(as_text(members['message']))
    if 'cause' in members:
      error.__cause__ = self.build(members['cause'])
    return error

  def build_error(self, descriptor: Json) -> ErosError:
    members = as_object(descriptor)
    error_class = self.error_class(members)
    message = as_optional_text(members.get('message'))
    details = members.get('details')
    if issubclass(error_class, UnexpectedError):
      error: ErosError = error_class(
        message, details=None if details is None else as_object(details)
      )
    elif issubclass(error_class, ValidationError):
      error = error_class(
        message,
        errors=self.failures(details),
        is_retryable=as_optional_flag(members.get('isRetryable')),
        retry_after=self.duration(members.get('retryAfterSeconds')),
      )
    else:
      error = error_class(
        message,
        details=None if details is None else as_object(details),
        is_retryable=as_optional_flag(members.get('isRetryable')),
        retry_after=self.duration(members.get('retryAfterSeconds')),
      )
    if 'cause' in members:
      error.__cause__ = self.build(members['cause'])
    return error

  def error_class(self, descriptor: Json) -> type[ErosError]:
    members = as_object(descriptor)
    kind_class = KIND_CLASSES[as_kind(members['kind'])]
    if 'meta' not in members and 'class' not in members:
      return kind_class
    name = as_optional_text(members.get('class'))
    if name is not None and name in self.classes:
      return self.classes[name]
    meta = as_object(members.get('meta', {}))
    meta_of_class = ErrorMeta(
      module=as_optional_text(meta.get('module')),
      entity=as_optional_text(meta.get('entity')),
      reason=as_optional_text(meta.get('reason')),
    )
    metaclass = type(kind_class)
    declared = metaclass(
      name or f'{kind_class.__name__}WithMeta', (kind_class,), {'meta': meta_of_class}
    )
    assert issubclass(declared, ErosError)
    if name is not None:
      self.classes[name] = declared
    return declared

  @staticmethod
  def failures(details: Json) -> list[ValidationFailure]:
    if details is None:
      return []
    return [
      ValidationFailure(
        pointer=as_text(item['pointer']),
        code=as_text(item['code']),
        detail=as_text(item['detail']),
      )
      for item in map(as_object, as_list(as_object(details)['errors']))
    ]

  @staticmethod
  def duration(seconds: Json) -> timedelta | None:
    if seconds is None:
      return None
    assert isinstance(seconds, int | float)
    return timedelta(seconds=seconds)
