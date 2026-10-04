# @droneey/eros

The model of eros: expected and unexpected errors, their kinds and codes, the mapper between layers, the JSON Pointers of a validation and the record a log writes. No dependencies; runs in the browser and in Bun. The projections on the transports — the problem a client receives, the HTTP and gRPC statuses, the exit codes — live in [`@droneey/eros-wire`](../wire).

## Install

```json
"@droneey/eros": "file:.droneey/kit/packages/eros/typescript/core"
```

A `retryAfter` is a `Temporal.Duration`. A runtime without `Temporal` loads its polyfill once, in its entry file.

## Use

```ts
import { NotFoundError, ViolationError, type ErosErrorInput } from '@droneey/eros';

class OrderNotFoundError extends NotFoundError {
  public constructor(input: ErosErrorInput = {}) {
    super({ ...input, meta: { module: 'orders', entity: 'order' } }); // orders/order/not-found
  }
}

class OrderAlreadyPaidError extends ViolationError {
  public constructor(input: ErosErrorInput = {}) {
    super({ ...input, meta: { module: 'orders', entity: 'order', reason: 'already-paid' } }); // orders/order/violation/already-paid
  }
}
```

A code is `[<module>/<entity>/]<kind>[/<reason>]`, each segment in lower kebab case. The kind is always in it; a reason is added after the kind and is optional for every kind, `violation` included; the module and the entity come together or not at all. An unexpected error's code is always `internal`. An error refuses, when it is built, a meta that breaks these rules, a negative `retryAfter`, and a validation failure whose `pointer` is not a JSON Pointer in URI fragment form (`#/items/0/quantity`); the types refuse a module without an entity before that.

- `ErrorKind` and `KINDS` hold each kind of `common/spec/kinds.yaml`: its class, title, default message, retry default and category.
- `parseCode(code)` reads a code back into `{ module?, entity?, kind, reason? }` by its number of segments. It checks neither the kind nor the spelling, gives `undefined` for an empty segment or a count outside 1 to 4, and never throws.
- `hasCode(error, code)` recognises an expected error by its code: the only way to catch an error of another module, or one that came over the network.
- `createErrorMapper({ mode, mappings?, validationMapper? })` maps errors at the border between layers; `prefixValidationFields` and `createValidationMapper` rewrite the JSON Pointers of a `ValidationError`, and `isPointer` tells a JSON Pointer.
- `toRecord(error)` gives the record a log writes: the code and its `module`, `entity`, `kind` and `reason`, the category, every cause. An adapter hands it to `onError` as an `ErrorEvent`, `{ error, record }`; the level is the logger's choice.
