# droneey-eros-wire

eros on the transports, module `droneey_eros_wire`: the RFC 9457 problem a client receives and the error it parses back, the HTTP and gRPC statuses, the CLI's exit codes, the queue dispositions and the MCP outcome of each kind. It depends on [`droneey-eros`](../core) alone; a domain imports the core and never this package. Python 3.14.

## Install

```toml
[project]
dependencies = ["droneey-eros", "droneey-eros-wire"]

[tool.uv.sources]
droneey-eros = { path = ".droneey/kit/packages/eros/python/core" }
droneey-eros-wire = { path = ".droneey/kit/packages/eros/python/wire" }
```

## Use

Each transport has its own function; an adapter knows its transport and calls it.

| Function | What it gives |
|---|---|
| `to_problem(error, trace_id=None, type_base=None)` | The problem body, as `application/problem+json` (`PROBLEM_MEDIA_TYPE`). An error that is not expected is masked. |
| `parse_problem(status, body)` | The error a response stands for. |
| `to_http_status(error)` | The HTTP status. |
| `to_grpc_status(error)` | The name of the gRPC status. |
| `to_exit_code(error)` | The CLI's exit code, from sysexits. |
| `to_queue_disposition(error)` | `retry`, `retry-if-idempotent`, `dead-letter` or `dead-letter-and-alert`. |
| `to_mcp_outcome(error)` | `tool-error`, a tool result with `isError` and the problem, or `internal-error`, a masked JSON-RPC error `-32603`. |

Each projection is that of the error's kind in `common/spec/kinds.yaml` (`PROJECTIONS`), found by its class's ancestry; an error that is not of eros projects as `internal`. An expected error whose `is_retryable` differs from its kind's default goes to `retry` when it is true and to `dead-letter` when it is false.

The problem's `type` is `about:blank`, or `<type_base>/<code>` given a type base. `detail` is the message, `isRetryable` is always there, `retryAfterSeconds` is the error's `retry_after` in whole seconds rounded up, and `traceId` is the trace the adapter passes. Only a validation's failures reach the body, as `errors`; the parts of the code never do, and a client that needs them calls `parse_code`.

`parse_problem` gives the kind of a status of the table, with the body's `code`, `detail`, `errors` and `retryAfterSeconds`; a `ViolationError` for another 4xx; and an `UnexpectedError` whose details hold the status and the body for anything else. A body is a problem when its `code` and `detail` are strings and the code is not empty; a member of the wrong type, a failure whose pointer is not a JSON Pointer among them, is ignored.
