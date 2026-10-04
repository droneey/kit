from .expected_error import ExpectedError


# eros names each class after its kind, in every language; import the module, or alias the
# class, where the builtin TimeoutError is needed beside it.
class TimeoutError(ExpectedError):  # noqa: A001 -- the class of the kind timeout
  """Another system did not answer in time; not the client's slowness, which is no kind."""

  kind = 'timeout'
