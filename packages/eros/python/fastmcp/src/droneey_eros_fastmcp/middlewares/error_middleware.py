import json
from typing import TYPE_CHECKING, NoReturn, override

from fastmcp.exceptions import DisabledError, NotFoundError
from fastmcp.server.middleware import CallNext, Middleware, MiddlewareContext
from fastmcp.tools import ToolResult
from mcp import MCPError

from droneey_eros import ErosError, ErrorEvent, OnError, ValidationError, to_record
from droneey_eros_fastmcp.constants import (
  INTERNAL_ERROR,
  INVALID_PARAMS,
  INVALID_REQUEST,
)
from droneey_eros_fastmcp.utils import to_eros_error, unwrap
from droneey_eros_wire import Problem, to_mcp_outcome, to_problem

if TYPE_CHECKING:
  from fastmcp import Context
  from fastmcp.prompts import PromptResult
  from fastmcp.resources import ResourceResult
  from mcp.types import CallToolRequestParams, GetPromptRequestParams, ReadResourceRequestParams

  from droneey_eros_fastmcp.types import GetTraceId


class ErrorMiddleware(Middleware):
  """Answers the errors of tools, resources and prompts with a problem.

  A tool's expected error, a failed check of its arguments among them, is its result:
  `isError` is true and `structuredContent` holds the problem. A resource's or a prompt's
  expected error is a JSON-RPC error whose data is the problem: -32602 for a
  ValidationError, -32600 for the others. An unexpected error is always a masked JSON-RPC
  -32603, an MCPError a component raised among them. fastmcp's answers to an unknown or
  disabled component, and an MCPError fastmcp raises itself, pass unchanged. on_error
  receives each error once, to log it. The middleware never retries.
  """

  _on_error: OnError
  _get_trace_id: GetTraceId | None
  _type_base: str | None

  def __init__(
    self,
    *,
    on_error: OnError,
    get_trace_id: GetTraceId | None = None,
    type_base: str | None = None,
  ) -> None:
    self._on_error = on_error
    self._get_trace_id = get_trace_id
    self._type_base = type_base

  @override
  async def on_call_tool(
    self,
    context: MiddlewareContext[CallToolRequestParams],
    call_next: CallNext[CallToolRequestParams, ToolResult],
  ) -> ToolResult:
    try:
      return await call_next(context)
    except Exception as error:  # noqa: BLE001 -- every error of a tool is answered here
      _raise_if_fastmcps_own(error)
      eros_error = to_eros_error(unwrap(error))
      self._report(eros_error)
      problem = self._problem_of(context.fastmcp_context, eros_error)
      if to_mcp_outcome(eros_error) == 'internal-error':
        _raise_masked(problem, error)
      return ToolResult(
        content=json.dumps(problem), structured_content=dict(problem), is_error=True
      )

  @override
  async def on_read_resource(
    self,
    context: MiddlewareContext[ReadResourceRequestParams],
    call_next: CallNext[ReadResourceRequestParams, ResourceResult],
  ) -> ResourceResult:
    try:
      return await call_next(context)
    except Exception as error:  # noqa: BLE001 -- every error of a resource is answered here
      self._raise_as_json_rpc(context.fastmcp_context, error)

  @override
  async def on_get_prompt(
    self,
    context: MiddlewareContext[GetPromptRequestParams],
    call_next: CallNext[GetPromptRequestParams, PromptResult],
  ) -> PromptResult:
    try:
      return await call_next(context)
    except Exception as error:  # noqa: BLE001 -- every error of a prompt is answered here
      self._raise_as_json_rpc(context.fastmcp_context, error)

  def _raise_as_json_rpc(self, fastmcp_context: Context | None, error: Exception) -> NoReturn:
    _raise_if_fastmcps_own(error)
    eros_error = to_eros_error(unwrap(error))
    self._report(eros_error)
    problem = self._problem_of(fastmcp_context, eros_error)
    if to_mcp_outcome(eros_error) == 'internal-error':
      _raise_masked(problem, error)
    code = INVALID_PARAMS if isinstance(eros_error, ValidationError) else INVALID_REQUEST
    raise MCPError(code=code, message=problem['detail'], data=problem) from error

  def _report(self, eros_error: ErosError) -> None:
    self._on_error(ErrorEvent(error=eros_error, record=to_record(eros_error)))

  def _problem_of(self, fastmcp_context: Context | None, eros_error: ErosError) -> Problem:
    trace_id = None if self._get_trace_id is None else self._get_trace_id(fastmcp_context)
    return to_problem(eros_error, trace_id=trace_id, type_base=self._type_base)


def _raise_if_fastmcps_own(error: Exception) -> None:
  """Re-raises the errors fastmcp answers itself: an unknown or disabled component, an MCPError."""
  if isinstance(error, MCPError | NotFoundError | DisabledError):
    raise error


def _raise_masked(problem: Problem, error: Exception) -> NoReturn:
  raise MCPError(code=INTERNAL_ERROR, message=problem['detail'], data=problem) from error
