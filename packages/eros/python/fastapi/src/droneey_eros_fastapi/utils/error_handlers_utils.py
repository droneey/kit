from typing import TYPE_CHECKING, Final

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import (
  HTTPException,  # noqa: TID251 -- the handlers answer the one FastAPI raises
)

from droneey_eros import ErosError, ErrorEvent, ErrorKind, OnError, to_record
from droneey_eros_wire import PROBLEM_MEDIA_TYPE, to_problem

from .eros_error_utils import to_eros_error

if TYPE_CHECKING:
  from collections.abc import Mapping

  from fastapi import FastAPI, Request, Response

  from droneey_eros_fastapi.types import GetTraceId

_RETRY_AFTER: Final = 'Retry-After'


def add_error_handlers(
  app: FastAPI,
  *,
  on_error: OnError,
  http_exceptions: Mapping[int, ErrorKind] | None = None,
  get_trace_id: GetTraceId | None = None,
  type_base: str | None = None,
) -> None:
  """Answers every error of the app with a problem, as `application/problem+json`.

  An expected error of eros gives its problem and `Retry-After` when it has a retry_after;
  a RequestValidationError a validation with a pointer per failure. An HTTPException is
  translated only through http_exceptions, a table of status to kind such as
  HTTP_EXCEPTION_KINDS. Anything else is a masked 500. on_error receives each error once.
  """

  async def handle_error(request: Request, error: Exception) -> Response:
    eros_error = to_eros_error(error, http_exceptions=http_exceptions)
    on_error(ErrorEvent(error=eros_error, record=to_record(eros_error)))
    trace_id = None if get_trace_id is None else get_trace_id(request)
    problem = to_problem(eros_error, trace_id=trace_id, type_base=type_base)
    headers = (
      {_RETRY_AFTER: str(problem['retryAfterSeconds'])} if 'retryAfterSeconds' in problem else {}
    )
    return JSONResponse(
      problem, status_code=problem['status'], headers=headers, media_type=PROBLEM_MEDIA_TYPE
    )

  for error_class in (ErosError, RequestValidationError, HTTPException):
    app.add_exception_handler(error_class, handle_error)
  # Starlette gives the handler of Exception to its outermost middleware, which answers and
  # then re-raises to the server; the classes above are answered without that.
  app.add_exception_handler(Exception, handle_error)
