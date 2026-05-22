---
name: project-brief
description: Scope, goals, and identity of the vf-clamp npm package and vfclamp.com microservice
metadata:
  type: project
---

# vf-clamp — Project Brief

**One-sentence summary:** Restrict a variable font's design space to a specific range per axis — without Python, without installing fonttools — using a WASM runtime bundled with the package.

## What it is
- An npm package (`vf-clamp`) with two public functions:
  - `clampFont(source, { subfamilies, format? })` — produces one or more restricted font variants
  - `getInstances(source)` — reads the fvar table and returns axes + named instances
- A hosted microservice at vfclamp.com that exposes both functions as authenticated REST endpoints
- A landing page with an interactive no-install demo

## What it is not
- A full font editor or subsetting tool
- A client-side / browser package (Pyodide is Node.js only)
- A replacement for fonttools — it wraps fonttools' `varLib.instancer` via Pyodide WASM

## Constraints
- Pyodide is the runtime: ~20–30s cold start, ~1–2s warm
- Package is Node.js only — not browser-compatible
- Source fonts must be TTF (WOFF2 input not supported by fonttools instancer)
- Output can be TTF or WOFF2 (converted via `font.flavor = 'woff2'`)

## API surface (locked)
```ts
clampFont(source: ArrayBuffer | Uint8Array | Buffer, options: ClampOptions): Promise<ClampResult[]>
getInstances(source: ArrayBuffer | Uint8Array | Buffer): Promise<FontInstancesResult>

type ClampOptions = { subfamilies: SubfamilyConfig[]; format?: 'ttf' | 'woff2' }
type SubfamilyConfig = { name: string; axes: Record<string, AxisValue> }
type AxisValue = number | { min: number; max: number } | null
type ClampResult = { name: string; buffer: Uint8Array; format: 'ttf' | 'woff2' }
```

## Sites and repos
- npm: `vf-clamp` (published under Liiift Studio)
- GitHub: github.com/Liiift-Studio/vf-clamp
- Site: vfclamp.com (hosted on Vercel, project: vf-clamp, team: liiift)
- type-tools: registered as `vfClamp` submodule in type-tools monorepo
