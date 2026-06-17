# Contributing

Thanks for your interest! This is a pnpm + Turborepo monorepo; the publishable
library lives in [`packages/pro-visu`](packages/pro-visu), with a docs
site (`apps/docs`) and a sample target site (`apps/testing`).

## Setup

```bash
pnpm install
```

## Common tasks

```bash
pnpm typecheck                    # typecheck the workspace
pnpm test                         # unit tests (vitest)
pnpm build:lib                    # build the publishable package
pnpm --filter testing generate    # render the sample storefront's showcase assets
pnpm docs                         # run the docs site locally
```

## Pull requests

- Keep changes focused and match the surrounding code style.
- Add or update tests for behavior changes (`packages/pro-visu/test`).
- Make sure `pnpm typecheck` and `pnpm test` pass before opening a PR.

## Releases (maintainers)

See [`tools/releaser/README.md`](tools/releaser/README.md).
