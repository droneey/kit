from .eros_error import ErosError


class ExpectedError(ErosError):
  """A failure the program foresees: a client sees its code and message. Abstract."""
