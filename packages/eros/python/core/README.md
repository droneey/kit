# droneey-eros

The model of eros, module `droneey_eros`: expected and unexpected errors, their kinds and codes, the mapper between layers, the JSON Pointers of a validation and the record a log writes. No dependencies; Python 3.14. The projections on the transports — the problem a client receives, the HTTP and gRPC statuses, the exit codes — live in [`droneey-eros-wire`](../wire).

## Install

```toml
[project]
dependencies = ["droneey-eros"]

[tool.uv.sources]
droneey-eros = { path = ".droneey/kit/packages/eros/python/core" }
```

## Use

A feature's error subclasses a kind and names the public parts of its code in `meta`:

```python
from droneey_eros import ErrorMeta, NotFoundError, ViolationError


class OrderNotFoundError(NotFoundError):  # orders/order/not-found
  meta = ErrorMeta(module='orders', entity='order')


class OrderAlreadyPaidError(ViolationError):  # orders/order/violation/already-paid
  meta = ErrorMeta(module='orders', entity='order', reason='already-paid')
```

A code is `[<module>/<entity>/]<kind>[/<reason>]`, each segment in lower kebab case. The kind is always in it; a reason is added after the kind and is optional for every kind, `violation` included; the module and the entity come together or not at all. An unexpected error's code is always `internal`, so a subclass of `UnexpectedError` takes no meta. Meta that breaks these rules raises `ValueError` where the class is declared; a negative `retry_after` and a validation failure whose `pointer` is not a JSON Pointer in URI fragment form (`#/items/0/quantity`) raise it where the error is built. The cause is the standard one: `raise OrderNotFoundError('Order 42 not found.') from error`.

An error has its `kind`, `code`, `title` and `category`, a `message` (its kind's default text when none is given), `details`, `is_retryable` (its kind's default unless given) and `retry_after`, a `timedelta`.

| Name | What it gives |
|---|---|
| `KINDS` | Each kind of `common/spec/kinds.yaml`: the name of its class, its title, default message, retry default and category. |
| `parse_code(code)` | The `CodeParts` of a code, read by its number of segments, or `None` for an empty segment or a count outside 1 to 4. It checks neither the kind nor the spelling and never raises. |
| `has_code(error, code)` | Whether it is an expected error with this code: the only way to catch an error of another module, or one that came over the network. |
| `create_error_mapper(mode=..., mappings=..., validation_mapper=...)` | A function to call in an `except` block at a border between layers; it always raises. |
| `prefix_validation_fields(prefix, keep_at_root=...)`, `create_validation_mapper(rules)` | Rewrite the JSON Pointers of a `ValidationError`. |
| `to_pointer(path)` | The JSON Pointer of a path, in URI fragment form. |
| `to_record(error)` | The record a log writes: the code and its `module`, `entity`, `kind` and `reason`, the category, every cause. |
| `ErrorEvent`, `OnError` | What an adapter hands its `on_error` hook: `ErrorEvent(error=..., record=...)`. The level is the logger's choice. |

The kind classes keep the names of the kinds, so `droneey_eros.TimeoutError` shadows the builtin when it is imported by name.
