# eros fixtures

Inputs and expected outputs that every implementation passes with its own runner. There is one file for each operation, and each file holds a table of cases:

| File | Package | Operation | Input | Expected |
|---|---|---|---|---|
| `code.json` | core | building an error and reading its `code` | an error | `{ "code" }`, or `{ "isRejected": true }` |
| `parse-code.json` | core | `parseCode` | `{ "code" }` | the parts, or `{ "isUnparsed": true }` |
| `record.json` | core | `toRecord` | an error | the record, without stacks |
| `map.json` | core | `createErrorMapper` | `{ "mapper", "error" }` | `{ "throws" }` |
| `pointer.json` | core | `prefixValidationFields`, `createValidationMapper` | `{ "remap", "pointer" }` | the pointer |
| `projections.json` | wire | `toHttpStatus`, `toGrpcStatus`, `toExitCode`, `toQueueDisposition` and the MCP outcome | an error | `{ "http", "grpc", "mcp", "exitCode", "queue" }` |
| `problem.json` | wire | `toProblem` | `{ "error", "typeBase"?, "traceId"? }` | the problem body |
| `parse.json` | wire | `parseProblem` | `{ "status", "body" }` | a parsed error |

Python names the functions in snake case: `parse_code`, `to_record`, `to_http_status`.

The kinds, titles, default messages, retry defaults and projections come from [`../spec/kinds.yaml`](../spec/kinds.yaml). Every expected problem body validates against [`../spec/problem.schema.json`](../spec/problem.schema.json), and every expected record validates against [`../spec/error-record.schema.json`](../spec/error-record.schema.json). [`../__tests__/fixtures.test.ts`](../__tests__/fixtures.test.ts) checks both, and also checks the fixtures against the kinds.

## A file

```json
{
  "operation": "code",
  "description": "What the operation does.",
  "cases": [
    { "name": "should … when …", "input": {}, "expected": {} }
  ]
}
```

A runner turns each case into one test named after `name`. It builds the input from its descriptors, runs the operation, and compares the result with `expected`. Each comparison is strict deep equality on the whole value, unless the operation's section below names an exception. A member that is absent from `expected` must also be absent from the result, and `null` is never used in its place.

## Descriptors

Descriptors hold only data. A runner turns each one into a real value of its language.

### An error of eros

```json
{
  "kind": "not-found",
  "class": "OrderNotFoundError",
  "meta": { "module": "orders", "entity": "order", "reason": "archived" },
  "message": "Order 42 not found.",
  "details": { "orderId": "42" },
  "isRetryable": true,
  "retryAfterSeconds": 1.2,
  "cause": {}
}
```

| Member | Required | The runner |
|---|---|---|
| `kind` | yes | picks the kind's class from `kinds.yaml`: `not-found` is `NotFoundError`, `internal` is `UnexpectedError`. |
| `meta` | no | declares a subclass of the kind's class that carries this meta. Python sets it as the class attribute `meta = ErrorMeta(...)`, and TypeScript passes it to `super` in the subclass's constructor, as spec §3 shows. Each of `module`, `entity` and `reason` may be absent. |
| `class` | no | names that subclass. Within one file, a name always comes with the same `kind` and `meta`, and the runner declares the class once and reuses it. A mapping and an expected outcome refer to the class by this name. When there is a `class` but no `meta`, the subclass carries no meta. |
| `message` | no | passes it as the error's message. Without it, the error has its kind's default message. |
| `details` | no | passes it as the error's details. For `validation` it is `{ "errors": [ { "pointer", "code", "detail" } ] }`. |
| `isRetryable` | no | passes it and so overrides the kind's default. |
| `retryAfterSeconds` | no | passes a `retryAfter` of this many seconds, which may be fractional: `Temporal.Duration.from({ milliseconds: Math.round(seconds * 1000) })` in TypeScript, `timedelta(seconds=seconds)` in Python. |
| `cause` | no | builds the nested descriptor and passes it as the cause: the `cause` option in TypeScript, `__cause__` in Python. |

With neither `meta` nor `class`, the error is an instance of the kind's own class. No input descriptor gives an `internal` error a `meta`, `isRetryable` or `retryAfterSeconds`.

### A foreign error

```json
{ "foreign": { "name": "TypeError", "message": "…", "cause": {} } }
```

This is an error that is not of eros. The runner builds it as follows.

- TypeScript: when `globalThis[name]` is a constructor of `Error`, the runner uses it. Otherwise it builds an `Error` and sets its `name`.
- Python: when `builtins` holds an exception class of that name, the runner uses it. Otherwise it uses a new class of that name that extends `Exception`.

In both languages the message is passed to the constructor. `cause` is optional and is any descriptor.

### A thrown value

```json
{ "thrown": "boom" }
```

This is a value that is not an error, such as a string, an object or `null`. It appears only as the `error` of a map case. Python cannot raise such a value, so the Python runner skips every case whose `error` is a thrown value.

### A class

A mapping's `source` and `target` are an error descriptor that holds only `kind`, and optionally `meta` and `class`. `{ "kind": "not-found" }` is `NotFoundError` itself, so it also matches every subclass of it.

## Operations

### code

`input` is an error descriptor. When `expected` is `{ "code": "…" }`, the runner builds the error and compares its `code`: `[<module>/<entity>/]<kind>[/<reason>]`, the meta's module and entity, the kind, then the meta's reason, joined by slashes. The reason is added after the kind rather than put in its place, and is optional for every kind, `violation` included. An `internal` error always gives `internal`.

When `expected` is `{ "isRejected": true }`, the input is invalid and the implementation must refuse it:

- a meta segment that is not lower kebab case, `[a-z0-9]+(-[a-z0-9]+)*`, an empty string included;
- a `module` without an `entity`, or an `entity` without a `module`;
- a negative `retryAfterSeconds`;
- a validation failure whose `pointer` is not an RFC 6901 JSON Pointer in URI fragment form.

The runner checks only that the refusal is raised, not its class. Python raises it when the class is declared or when the error is built. TypeScript throws it when the error is built; where its types refuse the value too, the runner passes the descriptor's value through a cast.

### parse-code

`input.code` is a string. When `expected` holds the parts, `{ "module"?, "entity"?, "kind", "reason"? }`, the runner calls `parseCode` and compares the result. The parts come from the number of segments between the slashes:

| Segments | Parts |
|---|---|
| 1 | kind |
| 2 | kind, reason |
| 3 | module, entity, kind |
| 4 | module, entity, kind, reason |

`parseCode` is tolerant: it checks neither the kind against `kinds.yaml` nor the spelling of a segment. When `expected` is `{ "isUnparsed": true }`, the code has an empty segment or a count of segments outside 1 to 4, and `parseCode` gives `undefined` in TypeScript and `None` in Python. It never throws.

### projections

`input` is an error descriptor or a foreign one. The runner calls each projection and compares the whole object:

| Member | TypeScript | Python |
|---|---|---|
| `http` | `toHttpStatus` | `to_http_status` |
| `grpc` | `toGrpcStatus` | `to_grpc_status` |
| `mcp` | the MCP outcome: `tool-error` or `internal-error` | the same |
| `exitCode` | `toExitCode` | `to_exit_code` |
| `queue` | `toQueueDisposition` | `to_queue_disposition` |

Each value is the projection of the error's kind in `kinds.yaml`, which the implementation finds by the class's ancestry. Any error that is not of eros projects as `internal`. An expected error whose `isRetryable` differs from its kind's default overrides `queue`: `true` gives `retry` and `false` gives `dead-letter`. An error whose `isRetryable` equals its kind's default keeps the kind's `queue`, so a `timeout` stays `retry-if-idempotent`.

### problem

`input.error` is an error descriptor or a foreign one. The runner calls `toProblem` with these options:

- `typeBase` when `input.typeBase` is present. The type is then `<typeBase>/<code>`;
- `traceId` when `input.traceId` is present. An adapter reads the trace with a function the wiring gives it and passes the value; an empty trace is left out of the body.

`expected` is the whole body. Only a `validation`'s `details.errors` reach the body, as `errors`; any other details stay out of it. The parts of the code never reach the body.

### parse

`input.status` is a number and `input.body` is any JSON value: a problem, text, `null` or an array. `expected` describes the parsed error:

```json
{ "kind": "not-found", "code": "…", "message": "…", "isRetryable": false, "details": {}, "retryAfterSeconds": 30 }
```

The runner checks four things:

- the error is an instance of the class of `kind`;
- its `code`, `message` and `isRetryable` equal the expected ones;
- its details equal `details`, or are absent when `details` is absent;
- its `retryAfter`, in seconds, equals `retryAfterSeconds`, or is absent when that member is absent.

A body is a problem when it is an object whose `code` and `detail` are strings and whose `code` is not empty. The code is kept as it is, even when it is not in the format of eros. A member of the wrong type is ignored as if it were absent: an `isRetryable` that is not a boolean, a `retryAfterSeconds` that is not a whole, non-negative number, and each item of `errors` that is not a `{ pointer, code, detail }` of strings. Only a `validation` reads `errors`, and its details are `{ "errors": [] }` when the body has none. An `internal` error made from a response the parser does not recognise has the message `Unexpected response with status <status>.` and the details `{ "status", "body" }`.

### record

`input` is an error descriptor or a foreign one. `expected` is the record with every `stack` removed. An error of eros gives its `code` and the parts of the code: `module`, `entity` and `reason` only when it has them, and `kind` always. The runner first checks that every `stack` in the actual record, at any depth, is a string. Then it removes all of them and compares the rest.

### map

`input.mapper` holds the following members:

- `mode`: `expected`, `unexpected` or `transparent`;
- `mappings`: optional, a list of `{ "source", "target" }` class descriptors;
- `validationMapper`: optional, a remap descriptor, as in `pointer`.

`input.error` is an error descriptor, a foreign one or a thrown value. The runner builds the mapper, calls it with the built input, and catches what it throws.

- `{ "throws": "input" }`: the mapper rethrew the very input object, by identity.
- `{ "throws": { "kind", "class"?, "code", "details"?, "cause": "input" } }`: the mapper threw a new error. It is an instance of the class of `kind`, and of the declared `class` when one is named. Its `code` equals `code`. Its details equal `details`, or `details` is not compared when it is absent. Its cause is the very input object. The message is not compared.

### pointer

`input.remap` is a remap descriptor and `input.pointer` is a JSON Pointer in URI fragment form (RFC 6901 §6). The runner builds the remap function, calls it with the pointer, and compares the result with `expected`, which is a string.

A remap descriptor is one of the following:

- `{ "prefixValidationFields": { "prefix": "#/strategyPayload", "keepAtRoot"?: ["generatedId"] } }`. The prefix is a pointer. Each entry of `keepAtRoot` is the unescaped name of a root member: the rule keeps a pointer whose first reference token is that name, escaped by RFC 6901 (`~` as `~0`, `/` as `~1`).
- `{ "createValidationMapper": [rule, …] }`. Each rule is either `{ "pattern", "replacement" }` or `{ "regex", "replacement" }`.
  - `pattern` is a string that matches only a pointer equal to it.
  - `regex` uses only the syntax that ECMAScript and Python share, and `replacement` refers to the regex's groups as `$1`, `$2`. The Python runner compiles the regex and rewrites each `$n` in the replacement as `\g<n>`. The rule replaces the first match only.
  - The first rule that matches wins, and a pointer that no rule matches comes back unchanged.

A replacement written as a function cannot be held as data, so each language's own specs cover it.
