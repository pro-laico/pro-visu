# testing

A sample target website + harness for **auto-showcase**: it's both the site the generators capture
and the viewer for the results.

```bash
pnpm --filter testing dev        # run the target site at http://localhost:4310
pnpm --filter testing generate   # build+start the site, generate assets into public/showcase
pnpm --filter testing check      # assert every generated asset exists with sane metadata
```

Then open `/gallery` (`pnpm --filter testing dev`) to view the generated assets.

- `app/` — the target site (rich sections for choreography/auto-sections, brand colours, a type
  specimen, and an interactive menu + card with stable ids for `actions`/`focus`) plus `/about` (for
  the route tour) and `/gallery` (reads `public/showcase/manifest.json`).
- `showcase.config.ts` — a managed-server config exercising the generators/features; output goes to
  `public/showcase/` (gitignored) so Next serves it.
- `scripts/check.mjs` — manifest/output validation.
