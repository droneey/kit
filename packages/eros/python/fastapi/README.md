# droneey-eros-fastapi

eros for FastAPI, module `droneey_eros_fastapi`: exception handlers that answer every error with an RFC 9457 problem and `Retry-After`, and an `on_error` hook for the log. It depends on [`droneey-eros`](../core) and [`droneey-eros-wire`](../wire). Python 3.14, FastAPI 0.142 or later.

## Install

```toml
[project]
dependencies = ["droneey-eros-fastapi"]

[tool.uv.sources]
droneey-eros = { path = ".droneey/kit/packages/eros/python/core" }
droneey-eros-wire = { path = ".droneey/kit/packages/eros/python/wire" }
droneey-eros-fastapi = { path = ".droneey/kit/packages/eros/python/fastapi" }
```

## Use

```python
from droneey_eros_fastapi import HTTP_EXCEPTION_KINDS, add_error_handlers

app = FastAPI()
add_error_handlers(
  app,
  on_error=log_error,
  http_exceptions=HTTP_EXCEPTION_KINDS,
  get_trace_id=lambda request: request.headers.get('traceparent'),
  type_base='https://errors.example.com',
)
```

| Option | What it does |
|---|---|
| `on_error` | Receives an `ErrorEvent(error, record)` once for each error, to log it. The error is always of eros; a foreign one comes wrapped in an `UnexpectedError` whose `__cause__` it is. |
| `http_exceptions` | The table of status to kind by which an `HTTPException` is translated. `HTTP_EXCEPTION_KINDS` holds every status of the kinds' table. Without it, no `HTTPException` is translated. |
| `get_trace_id` | Reads the request's trace for the problem's `traceId`. |
| `type_base` | Gives the problem a `type` of `<type_base>/<code>` instead of `about:blank`. |

The answer is `application/problem+json`, by the error:

| Error | Answer |
|---|---|
| An expected error of eros | Its problem; `Retry-After` in whole seconds when it has a `retry_after`. |
| `RequestValidationError` | A `ValidationError` with one failure per member: a JSON Pointer, pydantic's type in lower kebab case as the code (`int-parsing`), and its message. A body member is pointed at from the root, `#/items/0/quantity`; a parameter carries its location, `#/query/limit`; a body that is not JSON is `#`. Its cause is the `RequestValidationError` rebuilt without the values it rejected, so the log never sees them. |
| `HTTPException` whose status `http_exceptions` holds | An error of that kind with its default message and its bare code, `conflict`. Only the status is read: the exception's detail and headers stay out of the answer, and the exception is the error's `__cause__`, so its detail reaches the log. |
| Any other `HTTPException`, an `UnexpectedError`, anything else | The masked 500. |

## Logging

`on_error` logs each error once, so the server must not log it again. Starlette answers an error that is not of eros, FastAPI or Starlette and then re-raises it, and uvicorn logs it on `uvicorn.error`. Silence that line:

```python
import logging
from typing import override


class DropAnsweredErrors(logging.Filter):
  @override
  def filter(self, record: logging.LogRecord) -> bool:
    return record.getMessage() != 'Exception in ASGI application'


logging.getLogger('uvicorn.error').addFilter(DropAnsweredErrors())
```

eros chooses no log level: the logger does, or until there is one, the wiring with its own table. The default table:

| Error | Level |
|---|---|
| An unexpected error | error |
| `unauthorized`, `forbidden`, `rate-limited`, `unavailable`, `timeout` | warn |
| Any other expected error | info |

```python
WARNING_KINDS = frozenset({'unauthorized', 'forbidden', 'rate-limited', 'unavailable', 'timeout'})


def log_error(event: ErrorEvent) -> None:
  if event.error.category == 'unexpected':
    level = logging.ERROR
  elif event.error.kind in WARNING_KINDS:
    level = logging.WARNING
  else:
    level = logging.INFO
  logger.log(level, event.record['message'], extra={'error': event.record})
```
