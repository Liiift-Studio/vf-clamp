---
name: tech-context
description: Stack, dependencies, build config, and environment for vf-clamp
metadata:
  type: project
---

# Tech Context

## Core package (`/`)
- **Language:** TypeScript (strict), compiled to ESM + CJS via Vite library mode
- **Runtime:** Node.js only — Pyodide WASM requires Node FS APIs
- **Key dependency:** `@web-alchemy/fonttools` — fonttools compiled to WASM; provides `preparePyodide()` and `PyodideFile`
- **Build:** `vite build` → `dist/index.js` (ESM) + `dist/index.cjs` (CJS) + `dist/index.d.ts`
- **Vite externals:** `@web-alchemy/fonttools`, `/^node:/` — both must stay external or build fails
- **Tests:** Vitest — unit tests mock Pyodide, integration tests use real Pyodide + Inter Variable TTF

## Pyodide pattern
```ts
// All Pyodide access via createRequire at module level (NOT dynamic import)
import { createRequire } from 'node:module'
const _require = createRequire(import.meta.url)
const { preparePyodide, PyodideFile } = _require('@web-alchemy/fonttools/src/pyodide.js')
```
`preparePyodide()` is a singleton — first call starts Pyodide (~20–30s), subsequent calls return the cached instance.

## WOFF2 conversion
```python
from fontTools.ttLib import TTFont
font = TTFont('input.ttf')
font.flavor = 'woff2'
font.save('output.woff2')
```
Brotli is loaded automatically by the Pyodide init in `@web-alchemy/fonttools`.

## Site (`/site`)
- **Framework:** Next.js App Router (latest)
- **Styles:** Tailwind CSS 4 + `base.css` (synced from type-tools/shared)
- **Fonts:** Merriweather (serif headings), Inter (body), loaded locally from `public/fonts/`
- **Package manager:** npm
- **Key next.config.ts settings:**
  - `serverExternalPackages: ['@web-alchemy/fonttools', 'vf-clamp']` — prevents Webpack bundling Pyodide
  - `experimental: { instrumentationHook: true }` — enables Pyodide pre-warm at function boot
  - `turbopack.root: path.resolve(__dirname, '..')` — allows imports of `../../../package.json`
- **Instrumentation:** `src/instrumentation.ts` calls `preparePyodide()` once at function boot (non-fatal if it fails)

## API routes
| Route | Auth | Purpose |
|-------|------|---------|
| `POST /api/clamp` | `X-API-Key` header | Production — accepts fontUrl + subfamilies |
| `POST /api/instances` | `X-API-Key` header | Production — accepts fontUrl |
| `POST /api/demo/clamp` | None (rate limited) | Demo — accepts base64 font body |
| `POST /api/demo/instances` | None (rate limited) | Demo — accepts raw binary body |

## Vercel
- Project ID: `prj_FCz4dBRJiu25HKgHluBP8R97PCKb`
- Team: `team_dOf2bXUQPJjIxnvbgkGeIX88` (Liiift Studio)
- Region: iad1 (Washington DC)
- Build command: `npm run build && cd site && npx next build`
- Env vars: `VF_CLAMP_API_KEY`

## Git remotes (in type-tools/vfClamp submodule)
- `origin`: https://github.com/Liiift-Studio/vf-clamp.git
- `deploy`: git@github-liiift:Liiift-Studio/vf-clamp.git
