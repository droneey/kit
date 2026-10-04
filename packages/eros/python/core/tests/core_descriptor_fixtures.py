"""The cases of common/fixtures and the errors their descriptors stand for, as its README says."""

import builtins
import json
import re
from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path

from droneey_eros import (
  KINDS,
  ConflictError,
  ErosError,
  ErrorKind,
  ErrorMapper,
  ErrorMeta,
  ExpectedError,
  ExpiredError,
  ForbiddenError,
  MapperMode,
  NotFoundError,
  PayloadTooLargeError,
  PointerRemap,
  RateLimitedError,
  TimeoutError,  # noqa: A004 -- the class of the kind timeout
  UnauthorizedError,
  UnavailableError,
  UnexpectedError,
  ValidationError,
  ValidationFailure,
  ValidationRule,
  ViolationError,
  create_error_mapper,
  create_validation_mapper,
  prefix_validation_fields,
)

# The product's common/, the nearest above the spec: mutmut runs a copy of tests/ in mutants/.
COMMON = next(
  folder / 'common' for folder in Path(__file__).parents if (folder / 'common' / 'spec').is_dir()
)

# The class of each kind, as the spec names it.
KIND_CLASSES: dict[ErrorKind, type[ErosError]] = {
  'validation': ValidationError,
  'unauthorized': UnauthorizedError,
  'forbidden': ForbiddenError,
  'not-found': NotFoundError,
  'conflict': ConflictError,
  'expired': ExpiredError,
  'payload-too-large': PayloadTooLargeError,
  'violation': ViolationError,
  'rate-limited': RateLimitedError,
  'unavailable': UnavailableError,
  'timeout': TimeoutError,
  'internal': UnexpectedError,
}

MODES: tuple[MapperMode, ...] = ('transparent', 'expected', 'unexpected')

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


def as_mode(value: Json) -> MapperMode:
  for mode in MODES:
    if mode == value:
      return mode
  message = f'Not a mode of the mapper: {value!r}.'
  raise ValueError(message)


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

  def build_exception(self, descriptor: Json) -> Exception:
    error = self.build(descriptor)
    assert isinstance(error, Exception)
    return error

  def build_mapper(self, descriptor: Json) -> ErrorMapper:
    """The mapper of a map case, with the classes of its mappings declared by this builder."""
    options = as_object(descriptor)
    remap = options.get('validationMapper')
    return create_error_mapper(
      mode=as_mode(options['mode']),
      mappings=[
        (self.expected_class(mapping['source']), self.expected_class(mapping['target']))
        for mapping in map(as_object, as_list(options.get('mappings', [])))
      ],
      validation_mapper=None if remap is None else build_remap(remap),
    )

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
    declared = declare_error(kind_class, meta_of_class, name=name)
    if name is not None:
      self.classes[name] = declared
    return declared

  def expected_class(self, descriptor: Json) -> type[ExpectedError]:
    error_class = self.error_class(descriptor)
    assert issubclass(error_class, ExpectedError)
    return error_class

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


def declare_error(
  kind_class: type[ErosError], meta: ErrorMeta, *, name: str | None = None
) -> type[ErosError]:
  """A class of the kind with the meta, as a program declares one."""
  declared = type(kind_class)(
    name or f'{kind_class.__name__}WithMeta', (kind_class,), {'meta': meta}
  )
  assert issubclass(declared, ErosError)
  return declared


def build_remap(descriptor: Json) -> PointerRemap:
  r"""The remap function of a remap descriptor; a regex's `$n` becomes `\g<n>`."""
  members = as_object(descriptor)
  if 'prefixValidationFields' in members:
    options = as_object(members['prefixValidationFields'])
    return prefix_validation_fields(
      as_text(options['prefix']),
      keep_at_root=[as_text(name) for name in as_list(options.get('keepAtRoot', []))],
    )
  rules: list[ValidationRule] = []
  for rule in map(as_object, as_list(members['createValidationMapper'])):
    replacement = as_text(rule['replacement'])
    if 'pattern' in rule:
      rules.append((as_text(rule['pattern']), replacement))
    else:
      rules.append(
        (re.compile(as_text(rule['regex'])), re.sub(r'\$(\d+)', r'\\g<\1>', replacement))
      )
  return create_validation_mapper(rules)
