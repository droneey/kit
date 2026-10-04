from typing import TYPE_CHECKING, NoReturn

from droneey_eros.errors import ExpectedError, UnexpectedError, ValidationError, ValidationFailure

if TYPE_CHECKING:
  from collections.abc import Sequence

  from droneey_eros.types import ErrorMapper, ErrorMapping, MapperMode, PointerRemap


def create_error_mapper(
  *,
  mode: MapperMode,
  mappings: Sequence[ErrorMapping] = (),
  validation_mapper: PointerRemap | None = None,
) -> ErrorMapper:
  """A mapper for the boundary between layers or modules, called in an `except` block.

  It always raises, in this order: an UnexpectedError as it is; a new ValidationError with
  its pointers remapped, when validation_mapper is given; the target of the first mapping
  whose source the error is an instance of; then by mode, the error itself (`transparent`,
  or `expected` for an ExpectedError) or an UnexpectedError. A new error's `__cause__` is
  the input.
  """

  def map_error(error: Exception) -> NoReturn:
    mapped = _mapped(error, mode=mode, mappings=mappings, validation_mapper=validation_mapper)
    if mapped is error:
      raise error
    raise mapped from error

  return map_error


def _mapped(
  error: Exception,
  *,
  mode: MapperMode,
  mappings: Sequence[ErrorMapping],
  validation_mapper: PointerRemap | None,
) -> Exception:
  if isinstance(error, UnexpectedError):
    return error
  if validation_mapper is not None and isinstance(error, ValidationError):
    return _remap(error, validation_mapper)
  for source, target in mappings:
    if isinstance(error, source):
      return target()
  if mode == 'transparent' or (mode == 'expected' and isinstance(error, ExpectedError)):
    return error
  return UnexpectedError()


def _remap(error: ValidationError, remap: PointerRemap) -> ValidationError:
  return ValidationError(
    error.message,
    errors=[
      ValidationFailure(pointer=remap(failure.pointer), code=failure.code, detail=failure.detail)
      for failure in error.errors
    ],
  )
