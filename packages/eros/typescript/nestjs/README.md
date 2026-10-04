# @droneey/eros-nestjs

eros for NestJS: the exception filter, the SSE and timeout interceptors, the CQRS handler, `@ValidateDto` and the OpenAPI helpers.

## Install

```json
"@droneey/eros": "file:.droneey/kit/packages/eros/typescript/core",
"@droneey/eros-wire": "file:.droneey/kit/packages/eros/typescript/wire",
"@droneey/eros-nestjs": "file:.droneey/kit/packages/eros/typescript/nestjs"
```

Peers: `@droneey/eros` and `@droneey/eros-wire`, `@nestjs/common`, `@nestjs/core` and `@nestjs/swagger` from 11, `rxjs` from 7.8, `class-validator` from 0.14, `class-transformer` from 0.5.1 and `reflect-metadata` from 0.2. The project compiles with `experimentalDecorators` and `emitDecoratorMetadata`, and its runtime has `Temporal` or loads its polyfill in the entry file.

## Throw

The project's code throws only errors of eros, never Nest's `HttpException` or one of its subclasses: the domain throws its kinds, an adapter translates a vendor's failure by its meaning, with the vendor's error as the cause. Nest's own exceptions — a route that does not exist, a body that does not parse, a throttler — reach the filter all the same, and become kinds only through the table the wiring passes.

## Wire

```ts
// root/wiring.ts
import { Reflector } from '@nestjs/core';
import { UnhandledExceptionBus } from '@nestjs/cqrs';
import { ErrorKind, type ErosError } from '@droneey/eros';
import {
  AllExceptionsFilter,
  AllExceptionsHandler,
  NEST_HTTP_EXCEPTION_KINDS,
  SseExceptionInterceptor,
  TimeoutInterceptor,
  type OnError,
} from '@droneey/eros-nestjs';

const WARNED_KINDS: ReadonlySet<ErrorKind> = new Set([
  ErrorKind.Unauthorized,
  ErrorKind.Forbidden,
  ErrorKind.RateLimited,
  ErrorKind.Unavailable,
  ErrorKind.Timeout,
]);

const levelOf = ({ kind }: ErosError): 'error' | 'warn' | 'info' => {
  if (kind === ErrorKind.Internal) {
    return 'error';
  }

  return WARNED_KINDS.has(kind) ? 'warn' : 'info';
};

const onError: OnError = ({ error, record }) => logger[levelOf(error)](record);
const httpExceptions = NEST_HTTP_EXCEPTION_KINDS;
const reflector = app.get(Reflector);

app.useGlobalInterceptors(
  new SseExceptionInterceptor({ reflector, onError, httpExceptions }),
  new TimeoutInterceptor({ reflector, timeout: Temporal.Duration.from({ seconds: 30 }) }),
);
app.useGlobalFilters(new AllExceptionsFilter({ httpAdapter: app.getHttpAdapter(), onError, httpExceptions }));
new AllExceptionsHandler({ onError }).subscribe(app.get(UnhandledExceptionBus));
```

`onError` receives an `ErrorEvent`, `{ error, record }`, once per error: the error as eros sees it and its log record. It holds no level: the logger chooses it, and until there is one the wiring does, by this table.

| Error | Level |
|---|---|
| unexpected (`internal`), or not of eros | error |
| `unauthorized`, `forbidden`, `rate-limited`, `unavailable`, `timeout` | warn |
| every other expected kind | info |

`getTraceId(host)` receives Nest's `ArgumentsHost` and returns the trace the problem carries as `traceId`, as `get_trace_id` does in the Python adapters.

- **`AllExceptionsFilter({ httpAdapter, onError?, httpExceptions?, getTraceId?, typeBase? })`** answers every exception with an `application/problem+json` body and its status, and sets `Retry-After` when the error has a `retryAfter`. An unexpected error, or one not of eros, is masked as a 500. It answers through Nest's HTTP adapter, not one platform's response; its specs run on Express. A response whose headers are already sent is only ended.
- **`httpExceptions`** is the table by which Nest's own exceptions become kinds; without it, every one is masked as a 500. `NEST_HTTP_EXCEPTION_KINDS` maps each status of the kinds to its kind — 400 to `validation`, 404 to `not-found`, 409 to `conflict`, 429 to `rate-limited` — and a project may pass a narrower `Map` of its own. Only the status is read: the answer is the kind's default text and its bare code (`conflict`), and the exception, with its message, becomes the cause, which reaches the log and never the client. A status the table does not hold is masked.
- **`SseExceptionInterceptor({ reflector, onError?, httpExceptions?, getTraceId?, typeBase? })`** ends a failing SSE stream with an `error` event whose data is the problem. Other routes are left to the filter.
- **`TimeoutInterceptor({ reflector, timeout, scheduler? })`** fails a request whose handler outlives `timeout` with a `TimeoutError`; SSE streams are left to run. The timeout runs on rxjs's `asyncScheduler` unless a `scheduler` is given, as a spec gives a virtual clock.

Both interceptors read whether a route is SSE through the `reflector` they receive, Nest's own, `app.get(Reflector)`.
- **`AllExceptionsHandler({ onError? }).subscribe(bus)`** reports what event handlers and sagas threw to `UnhandledExceptionBus`; the returned subscription stops it.

## Validate

```ts
@ValidateDto()
class CreateOrderCommand {
  public constructor(public readonly payload: CreateOrderDto) {}
}
```

`@ValidateDto()` on a class validates its constructor's DTO arguments; on a method, its arguments, and the DTOs that the members of a command or a query hold. A DTO is a class with class-validator constraints. A failure throws a `ValidationError` whose `errors` locate each member by JSON Pointer inside its DTO, `#/items/0/quantity`, with the code `invalid-format`. An async method, or one declared to return a promise, rejects instead of throwing.

The compiler records a parameter's type only when its class is imported as a value: an `import type` of a DTO, which a linter may ask for, turns its validation off.

## Document

```ts
@Get(':id')
@ApiExpectedErrors(new OrderNotFoundError(), new OrderAlreadyPaidError())
public readOrder(): Promise<OrderDto> { … }
```

`ApiExpectedErrors(...errors)` adds one `application/problem+json` response per status, with an example per code. `generateErrorResponses(...errors)` gives the same responses as data, and `PROBLEM_SCHEMA` the OpenAPI schema of the problem.
