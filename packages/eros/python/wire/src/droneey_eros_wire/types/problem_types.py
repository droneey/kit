from typing import NotRequired, TypedDict


class ProblemFailure(TypedDict):
  """One failed member of a validation: its JSON Pointer, its code and what it failed."""

  pointer: str
  code: str
  detail: str


class Problem(TypedDict):
  """The RFC 9457 body a client receives: common/spec/problem.schema.json."""

  type: str
  title: str
  status: int
  detail: str
  code: str
  isRetryable: bool
  retryAfterSeconds: NotRequired[int]
  traceId: NotRequired[str]
  errors: NotRequired[list[ProblemFailure]]
