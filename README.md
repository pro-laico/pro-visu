# pro-visu (monorepo)

A pnpm + Turborepo workspace for the **pro-visu** screenshot/reel generator and its apps.

- **[`packages/pro-visu`](packages/pro-visu/README.md)** — the library + `pro-visu` CLI that
  generates marketing/showcase assets (scroll reels, screenshots, media walls, type/colour specimens, …)
  from a website.
- **`apps/docs`** — the documentation site (fumadocs).
- **`apps/testing`** — a sample target site that exercises every generator, with a `/gallery` of the
  generated assets and output checks.

## Commands

```bash
pnpm install
pnpm build        # turbo: build the library + apps
pnpm build:lib    # just the library (what the linked main-site consumes)
pnpm test         # library unit tests
pnpm typecheck    # typecheck the workspace
pnpm docs         # dev the docs app
pnpm testing      # dev the testing app
```

The library lives in `packages/pro-visu`; see its README for full generator/option docs.
