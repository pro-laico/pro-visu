# Releaser

Tag-driven npm publishing for `auto-showcase`, modeled on atomic-payload's
`tools/releaser`. Plain Node ESM — no extra dependencies.

## Cutting a release (maintainers)

```bash
pnpm release                 # patch bump (interactive); also --bump minor|major|prerelease
git push --follow-tags       # the v* tag triggers .github/workflows/release.yml
```

`release.mjs` bumps `packages/auto-showcase/package.json`, commits
`chore(release): vX.Y.Z`, and creates the annotated `vX.Y.Z` tag. The workflow then
runs `pnpm publish-packages` to publish to npm.

## npm auth — Trusted Publishing (OIDC)

The workflow uses npm **Trusted Publishing** (OIDC): no `NPM_TOKEN` secret, and
provenance is attached automatically. One-time setup:

1. Make the GitHub repo **public** (provenance attestations are public).
2. Publish the **first** version locally — OIDC cannot create a brand-new package:
   ```bash
   npm login
   pnpm publish-packages
   ```
3. On npmjs.com → the package → **Settings → Trusted Publisher**, point it at this
   repo and `.github/workflows/release.yml`.

After that, every `v*` tag publishes automatically. If OIDC is ever unavailable,
add an `NPM_TOKEN` repo secret and uncomment the fallback step in the workflow.

## Scripts

| Command | Script | What it does |
|---|---|---|
| `pnpm release` | `release.mjs` | Bump version, commit, tag. Flags: `--bump`, `--preid`, `--dry-run`, `--yes`, `--skip-git`. |
| `pnpm publish-packages` | `publish.mjs` | `pnpm publish` to npm; skips already-published versions. Flags: `--tag`, `--dry-run`, `--provenance`, `--yes`. |
