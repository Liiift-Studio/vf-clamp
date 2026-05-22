---
name: progress
description: What works, what's left, and known issues
metadata:
  type: project
---

# Progress

## What works (v0.1 → v1.0)
- `clampFont()` — pins axes or restricts to ranges, multi-subfamily, TTF + WOFF2 output
- `getInstances()` — reads fvar table, returns axes + named instances
- 18 tests passing (unit mocks + integration with real Pyodide + Inter Variable)
- Site builds and deploys on Vercel (iad1)
- Landing page — hero, how it works, usage examples, getInstances section, REST API docs
- Interactive demo — font upload, axis controls, named instance chips, code gen, download
- OG image with axis-range visual
- Rate limiting on unauthenticated demo endpoints
- Pyodide pre-warming (instrumentation hook + IntersectionObserver ping)
- All 17 type-tools footers updated (sync-sites run 2026-05-22)

## Known issues / limitations
- Pyodide cold start is ~20–30s on first request after function boot — addressed with warmup but still visible to users who are first
- WOFF2 input not supported (fonttools instancer requires TTF)
- Demo max file size is 20 MB — could be lowered if abuse becomes a problem
- Rate limiter is in-memory per function instance — resets on cold start, not suitable for strict enforcement

## Not yet implemented
- Darden/foundry Sanity integration (async webhook + progress tracking)
- Vercel cron warmup endpoint (`/api/warmup`) for foundry use case
- Font subsetting (only axis restriction, not glyph subsetting)
- Batch endpoint (multiple fonts in one call)
- WOFF2 input support

## Version history
- `0.1.0` — initial release: clampFont, getInstances, TTF + WOFF2, site, demo
- `1.0.0` — v1 milestone: OG image, rate limiting, accessibility, .agent/memory init
