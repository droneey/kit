# kit

Runtime packages for TypeScript and Python, each with the constitution's rules for its slice: eros for errors first.

Each product keeps its packages under `packages/<product>/`: language-free files in `common/`, then one folder per language.

## eros

eros splits errors into expected and unexpected ones and turns them into a response for the client (RFC 9457 problem), a record for the log, and back into an error on the client. It works without the constitution.

| Package | Language | What it holds |
|---|---|---|
| [`@droneey/eros`](packages/eros/typescript/core) | TypeScript | The model: error classes, kinds, codes and `parseCode`, the record and the mapper. What a domain imports; no dependencies, runs in the browser too. |
| [`@droneey/eros-wire`](packages/eros/typescript/wire) | TypeScript | The projections onto transports: the RFC 9457 problem and its parser, HTTP and gRPC statuses, CLI exit codes, queue dispositions. |
| [`@droneey/eros-nestjs`](packages/eros/typescript/nestjs) | TypeScript | NestJS: exception filter, interceptors, DTO validation, OpenAPI helpers. |
| [`droneey-eros`](packages/eros/python/core) | Python | The model, as module `droneey_eros`. |
| [`droneey-eros-wire`](packages/eros/python/wire) | Python | The projections onto transports, as module `droneey_eros_wire`. |
| [`droneey-eros-fastapi`](packages/eros/python/fastapi) | Python | FastAPI exception handlers. |
| [`droneey-eros-fastmcp`](packages/eros/python/fastmcp) | Python | fastmcp middleware. |
| [`common/spec`](packages/eros/common/spec) | — | The kinds and the schemas both languages follow. |
| [`common/fixtures`](packages/eros/common/fixtures) | — | Input and expected output every implementation passes. |

## Install

kit ships as a release archive that mise installs and checks against `mise.lock`. In the consumer's `mise.toml`:

```toml
[tools]
"github:droneey/kit" = { version = "<version>", asset_pattern = "kit.tar.gz", strip_components = 0 }

[hooks]
postinstall = [
  "mkdir -p .droneey",
  "ln -sfn \"$(mise where github:droneey/kit)\" .droneey/kit",
]
```

Then take a package from the linked folder.

Bun, in `package.json`:

```json
{
  "dependencies": {
    "@droneey/eros": "file:.droneey/kit/packages/eros/typescript/core"
  }
}
```

uv, in `pyproject.toml`:

```toml
[project]
dependencies = ["droneey-eros"]

[tool.uv.sources]
droneey-eros = { path = ".droneey/kit/packages/eros/python/core" }
```

## Develop

```sh
mise trust && mise install   # the toolchain, the constitution's archive and the git hooks
bun install --frozen-lockfile
uv sync --locked
bun run check
```

`bun run check` runs every check of both languages, one script per area: Biome and Ruff, syncpack, tsc and ty, python-check and complexipy, dependency-cruiser and import-linter, `bun test` and pytest with full coverage, Stryker and mutmut on the changed code, betterleaks, ls-lint, knip, vulture and deptry, and OSV-Scanner.
