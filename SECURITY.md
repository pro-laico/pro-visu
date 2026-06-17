# Security Policy

## Reporting a vulnerability

Please report security issues privately via GitHub's
[private vulnerability reporting](https://github.com/pro-laico/pro-visu/security/advisories/new)
rather than a public issue. We'll acknowledge within a few days and keep you
updated on a fix.

## Scope

`pro-visu` drives a headless browser (Playwright) against URLs you point it
at and shells out to a bundled ffmpeg. Treat the sites, fonts, and config you feed
it as trusted input — it is a build-time tool, not a sandbox for untrusted content.
