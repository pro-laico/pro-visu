// Load Node's global types so `tsc --noEmit` (the `typecheck` script) passes on a clean checkout.
// Next normally brings these in via its generated `next-env.d.ts` (which references `next`, which
// references `node`), but that file is gitignored and only created by a `next` command — so it's
// absent on CI before any build. This app uses Node built-ins in server route files (e.g.
// `app/gallery/page.tsx`: node:fs/promises, node:path, process).
/// <reference types="node" />
