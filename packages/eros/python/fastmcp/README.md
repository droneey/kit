# droneey-eros-fastmcp

eros for fastmcp, module `droneey_eros_fastmcp`: middleware that returns a tool's expected error as its result with the problem, answers a resource's or a prompt's as a JSON-RPC error, masks an unexpected one, and an `on_error` hook for the log. It depends on [`droneey-eros`](../core) and [`droneey-eros-wire`](../wire). Python 3.14, fastmcp 4 or later.

## Install

```toml
[project]
dependencies = ["droneey-eros-fastmcp"]

[tool.uv.sources]
droneey-eros = { path = ".droneey/kit/packages/eros/python/core" }
droneey-eros-wire = { path = ".droneey/kit/packages/eros/python/wire" }
droneey-eros-fastmcp = { path = ".droneey/kit/packages/eros/python/fastmcp" }
```

## Use

```python
from droneey_eros_fastmcp import ErrorMiddleware

server = FastMCP('orders')
server.add_middleware(
  ErrorMiddleware(
    on_error=log_error,
    get_trace_id=lambda context: current_trace_id(),
    type_base='https://errors.example.com',
  )
)
```

`on_error` receives an `ErrorEvent(error, record)` once for each error, to log it; the error is always of eros, and a foreign one comes wrapped in an `UnexpectedError` whose `__cause__` it is. `get_trace_id` receives the request's fastmcp `Context`, or `None` outside a request. `type_base` gives the problem a `type` of `<type_base>/<code>`. The level of each error is the logger's choice; [`droneey-eros-fastapi`](../fastapi#logging) has the default table.

fastmcp raises a `ToolError`, `ResourceError` or `PromptError` from what a component raised, and the middleware answers for that cause:

| Error | Answer |
|---|---|
| A tool's expected error of eros | The tool's result: `isError` is true, `structuredContent` holds the problem, and a text block holds it as JSON. |
| A failed check of a tool's arguments, fastmcp's `ValidationError` raised from pydantic's | The same, as a `ValidationError` with a JSON Pointer per argument (`#/order_id`) and pydantic's type in lower kebab case as the code (`int-parsing`). Its cause holds pydantic's failures without the values they rejected, so the log never sees them. |
| A resource's or a prompt's expected error | A JSON-RPC error whose message is the detail and whose data is the problem: `-32602` for a `ValidationError`, `-32600` for the others. |
| Anything else, a bare `ToolError`, a `ValidationError` of fastmcp's that a tool's own code raised or an `MCPError` a tool raised among them | The masked JSON-RPC `-32603`, with the masked problem as data. |
| fastmcp's answer to an unknown or disabled component, an `MCPError` fastmcp raises itself | Unchanged. |

The middleware never retries.

## Logging

`on_error` logs each error once, so fastmcp must not log it again. fastmcp logs each error of a component before the middleware answers it, on `fastmcp.server.server` and, for a prompt, on `fastmcp.prompts.function_prompt`. `FASTMCP_LOG_ENABLED=false` does not silence those lines: it only leaves fastmcp's logger without its handler, and they reach the root logger instead. Silence them:

```python
import logging
from typing import override

COMPONENT_ERRORS = (
  'Error calling tool ',
  'Invalid arguments for tool ',
  'Error reading resource ',
  'Error rendering prompt ',
)


class DropAnsweredErrors(logging.Filter):
  @override
  def filter(self, record: logging.LogRecord) -> bool:
    return not record.getMessage().startswith(COMPONENT_ERRORS)


for name in ('fastmcp.server.server', 'fastmcp.prompts.function_prompt'):
  logging.getLogger(name).addFilter(DropAnsweredErrors())
```
