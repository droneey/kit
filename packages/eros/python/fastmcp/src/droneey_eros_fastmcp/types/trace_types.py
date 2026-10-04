from collections.abc import Callable

from fastmcp import Context

type GetTraceId = Callable[[Context | None], str | None]
"""Reads the trace of a request from its fastmcp context, for the problem's traceId."""
