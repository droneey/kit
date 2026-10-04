from collections.abc import Callable

from fastapi import Request

type GetTraceId = Callable[[Request], str | None]
"""Reads the trace of a request, for the problem's traceId."""
