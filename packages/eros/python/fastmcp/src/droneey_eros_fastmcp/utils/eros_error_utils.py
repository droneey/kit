from fastmcp.exceptions import PromptError, ResourceError, ToolError
from fastmcp.exceptions import ValidationError as ArgumentsError
from pydantic import ValidationError as PydanticValidationError

from droneey_eros import ErosError, UnexpectedError, ValidationError, ValidationFailure, to_pointer


def unwrap(error: Exception) -> Exception:
  """The error a tool, a resource or a prompt raised, under fastmcp's wrapper of it.

  fastmcp raises its ToolError, ResourceError or PromptError from what the component raised;
  one with no cause was raised by the component itself and stays.
  """
  while isinstance(error, ToolError | ResourceError | PromptError):
    cause = error.__cause__
    if not isinstance(cause, Exception):
      break
    error = cause
  return error


def to_eros_error(error: Exception) -> ErosError:
  """The error of eros an unwrapped error stands for; a translated one has it as `__cause__`.

  An error of eros stays as it is. fastmcp's failed check of a tool's arguments, raised from
  pydantic's ValidationError, is a ValidationError with a JSON Pointer per argument, whose
  cause is fastmcp's error rebuilt without the values it rejected, so the log never sees
  them. Anything else, a ValidationError of fastmcp the tool's own code raised among them,
  is unexpected.
  """
  if isinstance(error, ErosError):
    return error
  cause = error.__cause__
  if isinstance(error, ArgumentsError) and isinstance(cause, PydanticValidationError):
    return _validation_of(cause)
  translated = UnexpectedError()
  translated.__cause__ = error
  return translated


def _validation_of(error: PydanticValidationError) -> ValidationError:
  """A failure per argument pydantic refused, its type in lower kebab case: `int-parsing`."""
  failures = error.errors(include_url=False, include_input=False)
  translated = ValidationError(
    errors=[
      ValidationFailure(
        pointer=to_pointer(failure['loc']),
        code=failure['type'].replace('_', '-'),
        detail=failure['msg'],
      )
      for failure in failures
    ]
  )
  translated.__cause__ = ArgumentsError(str(failures))
  return translated
