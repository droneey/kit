# @droneey/eros-wire

eros on the transports: the RFC 9457 problem a client receives and its parser, and each kind's HTTP status, gRPC status, MCP outcome, CLI exit code and queue disposition, as the projections of `common/spec/kinds.yaml` give them. Depends on [`@droneey/eros`](../core) only; the domain never imports it.

## Install

```json
"@droneey/eros": "file:.droneey/kit/packages/eros/typescript/core",
"@droneey/eros-wire": "file:.droneey/kit/packages/eros/typescript/wire"
```

## Use

One function per transport, with no flag and no strategy: the adapter knows its transport. Each finds the kind by the error's class, so a subclass of `NotFoundError` projects as `not-found`, and anything that is not of eros projects as `internal`.

```ts
import { toHttpStatus, toProblem } from '@droneey/eros-wire';

response.status(toHttpStatus(error)).json(toProblem(error, { traceId, typeBase }));
```

- `toProblem(error, { traceId?, typeBase? })` gives the problem body. An unexpected error, or one not of eros, is masked; only a validation's failures reach the body, as `errors`. The type is `about:blank`, or `<typeBase>/<code>`; an empty `traceId` is left out; `retryAfterSeconds` is the `retryAfter` in whole seconds, rounded up.
- `parseProblem(status, body)` and `parseProblemResponse(response)` turn a response back into an error: a status of the kinds gives its kind, with the body's code as it is; another 4xx gives a `ViolationError`; anything else, or a body that is not a problem, gives an `UnexpectedError` whose details hold the status and the body; a response whose body cannot be read gives an `UnexpectedError` whose details hold the status and whose cause is the failure of the read. They never throw.
- `toHttpStatus`, `toGrpcStatus`, `toMcpOutcome` (`tool-error` or `internal-error`) and `toExitCode` give the kind's projection.
- `toQueueDisposition` gives the kind's disposition, unless the error's `isRetryable` differs from its kind's default: then `retry` when it is true, `dead-letter` when it is false.
- `PROJECTIONS` holds the whole table, and `HttpStatus`, `GrpcStatus`, `McpOutcome`, `ExitCode` and `QueueDisposition` its values.
