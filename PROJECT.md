# Project Context

> The stable, high-level context of the product: what it is, who it is for, the domains of its business, its core entities, its boundaries and its words. Read it first so any change fits the product, not just the task.

## One-liner

kit: runtime packages for TypeScript and Python that the owner's programs install, each product written once as a language-free contract and implemented in both languages; eros, the error kit, comes first.

## Context and users

- **The owner** writes the contracts and the packages, and decides every change.
- **Programs that install a package** — services, command-line tools and front ends in TypeScript or Python — take a product's packages in their own language and get the same behaviour as a program in the other.
- **Agents** in those programs follow the constitution, whose rules the packages keep, so a program built on them meets the rules without code of its own.

## Domains of the business

- **Contracts** — a product's language-free files in `packages/<product>/common/`: its specification and the fixtures every implementation passes.
- **Implementations** — a product's packages at `packages/<product>/<language>/<name>/`, one per language and integration, each proven by the shared fixtures.
- **eros** — errors: expected and unexpected ones, their codes, the problem a client receives, the record a log writes, and the error a client rebuilds from a response.

## Core entities and relationships

- **Product** — a folder of `packages/` with its contract in `common/` and its packages by language.
- **Package** — one published unit of a product in one language: a core, a projection onto transports, or an integration with a framework.
- **Kind** — one of eros's twelve kinds of error, with its class, title, default message, retry default and category; each kind has one projection on every transport.
- **Error** — an instance of a kind; an expected error carries a code a client may read, an unexpected one is masked.
- **Code** — `[<module>/<entity>/]<kind>[/<reason>]`, built from a kind and the meta of its class.
- **Problem** — the RFC 9457 body a client receives for an error.
- **Record** — the plain object a log writes of an error and its chain of causes.

## Critical scenarios

- An expected error raised in a program becomes the same problem in TypeScript and in Python, and the client rebuilds the same error from it: `problem.json` and `parse.json` of `common/fixtures/`, run by the specs of every package.
- An unexpected error reaches the client masked, and the log's record holds what the client does not see: `problem.json` and `record.json`.

## Boundaries — what it does not do

- No logger, no transport and no framework of its own: an integration package adapts a framework the program already uses.
- No business of any consumer: a package knows nothing of the programs that install it.
- No log levels: the program's logger chooses them.

## Glossary

- **Expected error** — a failure the program foresees, whose code and message a client sees.
- **Unexpected error** — a bug or an impossible state; the client gets a masked `internal`, a person is woken.
- **Meta** — the module, entity and reason a class of error names for its code.
- **Projection** — what a kind becomes on a transport: an HTTP or gRPC status, an MCP outcome, an exit code, a queue disposition.
- **Fixture** — a case of `common/fixtures/`: an input and the output every implementation gives for it.

## Non-functional notes

- Each package works without the constitution; it only follows its rules.
- The packages ship from one release archive that mise installs; one version for every package.
- The TypeScript core has no dependencies and runs in the browser too.
