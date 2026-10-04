# eros spec

The language-free source of eros, which every implementation follows:

- `kinds.yaml`: each kind by its id, with its class, title, default message, retry default and category, and a separate section of its projections on the transports: the HTTP status, the gRPC status, the MCP outcome, the CLI exit code and the queue disposition;
- `problem.schema.json`: the RFC 9457 problem a client receives;
- `error-record.schema.json`: the record a log writes.

Both schemas are JSON Schema draft-07. None of these files holds a log level: the logger chooses it.

## Kinds

A kind's id is in lower kebab case: `not-found`, `rate-limited`. Each language reads the titles, the default messages and the retry defaults from `kinds.yaml` rather than keeping a copy of its own.

The `core` package holds the kinds. The `wire` package holds the projections; the core does not know them. An expected error whose `isRetryable` differs from its kind's default overrides the queue column: `true` sends it to `retry`, `false` to `dead-letter`.

## Codes

```
[<module>/<entity>/]<kind>[/<reason>]
```

The meta's module and entity, the kind, then the meta's reason, joined by slashes. Each segment is lower kebab case, `[a-z0-9]+(-[a-z0-9]+)*`. Some examples:

- `orders/order/not-found`;
- `orders/order/not-found/archived`, when the class adds the reason `archived`;
- `orders/order/violation/already-paid`; a violation's reason is optional, like any other kind's;
- `not-found` and `validation/missing-body`, without a module and an entity;
- `internal`, which every unexpected error gives, with no other part.

The module and the entity come together or not at all. An error refuses meta that breaks these rules, a negative `retryAfter` and a validation failure whose pointer is not a JSON Pointer.

`parseCode` reads a code back by its number of segments: one is the kind; two are the kind and the reason; three are the module, the entity and the kind; four add the reason. It checks neither the kind nor the spelling, gives nothing for an empty segment or a count outside 1 to 4, and never throws.

Field codes in a validation's `errors` are in lower kebab case too: `invalid-format`.

[`../fixtures`](../fixtures) holds the cases every implementation passes.
