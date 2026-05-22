---
name: active-context
description: Current work state, recent changes, and immediate next steps
metadata:
  type: project
---

# Active Context

## Current focus
v1.0.0 release — completing all v1 checklist items before bumping version and publishing.

## Recently completed
- Core `clampFont()` + `getInstances()` API with Pyodide/fonttools pipeline
- TTF + WOFF2 output format support
- 18 tests (9 unit + 9 integration) — all passing
- Interactive demo with font upload, axis controls (Full/Pin/Range), code gen, download
- Pyodide pre-warming via instrumentation hook + IntersectionObserver
- Full landing page with type-tools conventions (Merriweather headings, teal accent)
- type-tools integration — `vfClamp` submodule, footer directory entry, sync-sites
- Vercel build fix — added `/^node:/` to Rollup externals in `vite.config.ts`
- OG image (`site/src/app/opengraph-image.tsx`)
- Rate limiting on demo routes (10 req/min/IP via `site/src/lib/rateLimit.ts`)
- Accessibility — `touch-action: none` on all range inputs, aria-labels, error state UX
- `.agent/memory/` initialised

## Immediate next steps
1. Version bump to `1.0.0` in both `package.json` and `site/package.json`
2. `npm run build && npm publish --access public`
3. Commit + push v1.0.0 tag
4. Darden/foundry webhook integration (post-v1 effort)
5. Vercel cron for Pyodide warmup (`/api/warmup`) — for foundry use case

## Active decisions
- Demo routes are unauthenticated but rate-limited (10 req/min/IP)
- Prod routes require `X-API-Key: <VF_CLAMP_API_KEY>` header
- Font input to demo is raw binary for instances, base64 JSON for clamp
- Pyodide pre-warm runs at function boot (instrumentation hook) — zero extra cost
