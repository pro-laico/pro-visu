// Ambient declaration for side-effect CSS imports (e.g. `import "./global.css"`), so the
// `typecheck` script (`tsc --noEmit`) passes on a clean checkout. Next normally provides this via
// its generated `next-env.d.ts`, but that file is gitignored and only created by a `next` command —
// so on CI, before any build, it doesn't exist yet. This committed declaration fills the gap and
// merges harmlessly with Next's types when they are present locally.
declare module "*.css";
