# vf-clamp

Restrict a variable font's axis ranges to a specific subfamily scope — like CSS `clamp()` for design space.

```
npm install vf-clamp
```

**[Interactive demo at vfclamp.com →](https://vfclamp.com)**

---

## What it does

Takes a variable font (TTF) and produces one restricted variant per configured subfamily. Each variant is a valid variable font with unused axis ranges trimmed, gvar deltas pruned, and STAT records updated. No Python required — powered by [fonttools](https://github.com/fonttools/fonttools) compiled to WASM via [Pyodide](https://pyodide.org).

---

## Usage

### Inspect a font first

```ts
import { getInstances } from 'vf-clamp'
import { readFile } from 'fs/promises'

const font = await readFile('MyFont-VF.ttf')
const { axes, instances } = await getInstances(font)

// axes:     [{ tag: 'wght', minimum: 100, default: 400, maximum: 900, name: 'Weight' }, ...]
// instances:[{ name: 'Regular', coordinates: { wght: 400 } }, ...]
```

Use the named instances to figure out what to clamp — adjacent instances naturally define the bounds for each subfamily.

### Clamp to axis ranges

```ts
import { clampFont } from 'vf-clamp'
import { readFile, writeFile } from 'fs/promises'

const source = await readFile('Omnes-VF.ttf')

const results = await clampFont(source, {
  subfamilies: [
    // Pin wdth to 75 — axis is removed from the output font
    { name: 'Condensed', axes: { wdth: 75 } },

    // Restrict wdth to a range — axis stays variable within [87.5, 100]
    { name: 'SemiCondensed', axes: { wdth: { min: 87.5, max: 100 } } },

    // Mixed: pin width, keep full weight range
    { name: 'Narrow', axes: { wdth: 62.5 } },
  ],
})

for (const result of results) {
  await writeFile(`Omnes-${result.name}-VF.ttf`, result.buffer)
}
```

### Output as WOFF2

```ts
const results = await clampFont(source, {
  format: 'woff2',
  subfamilies: [
    { name: 'Text', axes: { wght: { min: 400, max: 700 } } },
  ],
})

// result.buffer is a valid WOFF2 file — Brotli-compressed
await writeFile('Omnes-Text-VF.woff2', results[0].buffer)
```

---

## Axis value types

| Value | Effect |
|---|---|
| `number` | Pin the axis to that value — axis is removed from the output |
| `{ min, max }` | Restrict to a range — axis stays variable within those bounds |
| `null` | Drop the axis at its current default — same as pinning at default |
| *(omitted)* | Keep the full original range — axis is unchanged |

---

## API

### `getInstances(input)`

```ts
async function getInstances(
  input: ArrayBuffer | Uint8Array | Buffer
): Promise<{ axes: AxisDefinition[]; instances: FontInstance[] }>
```

Reads the fvar table and returns every axis and named instance defined in the font. Use this to discover what can be clamped before building a subfamily config.

### `clampFont(input, options)`

```ts
async function clampFont(
  input: ArrayBuffer | Uint8Array | Buffer,
  options: ClampOptions
): Promise<ClampResult[]>
```

**Parameters**

- `input` — Source variable font binary. Use the original source TTF, not WOFF/WOFF2.
- `options.subfamilies` — Array of `SubfamilyConfig` entries, one per output variant.
- `options.format` — `'ttf'` (default) or `'woff2'`.

**Returns**

Array of `ClampResult` in the same order as `options.subfamilies`:

```ts
interface ClampResult {
  name: string       // matches SubfamilyConfig.name
  buffer: Uint8Array // restricted font binary (TTF or WOFF2)
}
```

---

## Types

```ts
type AxisValue = number | AxisRange | null

interface AxisRange {
  min: number
  max: number
}

interface SubfamilyConfig {
  name: string
  axes: Record<string, AxisValue>
}

interface ClampOptions {
  format?: 'ttf' | 'woff2'
  subfamilies: SubfamilyConfig[]
}

interface AxisDefinition {
  tag: string
  name: string
  minimum: number
  default: number
  maximum: number
}

interface FontInstance {
  name: string
  coordinates: Record<string, number>
}
```

---

## Notes

- **Pyodide cold start**: first call initialises the Python WASM runtime (~2–4 s). Subsequent calls in the same process reuse it.
- **Input format**: use the source TTF, not WOFF2. The instancer works on TTF/OTF.
- **Subfamilies are processed sequentially** — Pyodide is single-threaded.
- **Adjacent instances**: when building subfamilies from named instances, select a contiguous run along the primary axis. Non-adjacent instances produce separate output files.

---

## REST API

vfclamp.com also exposes hosted endpoints. Useful for server-side workflows where the font is fetched by URL. Contact [hello@liiift.studio](mailto:hello@liiift.studio) to request an API key.

```
POST https://vfclamp.com/api/clamp
X-API-Key: <your-key>
Content-Type: application/json

{
  "fontUrl": "https://cdn.example.com/MyFont-VF.ttf",
  "format": "woff2",
  "subfamilies": [
    { "name": "Text", "axes": { "wght": { "min": 400, "max": 700 } } }
  ]
}
// → { results: [{ name, data, format, size }] }

POST https://vfclamp.com/api/instances
X-API-Key: <your-key>

{ "fontUrl": "https://cdn.example.com/MyFont-VF.ttf" }
// → { axes: [...], instances: [...] }
```

---

## License

MIT — [Liiift Studio](https://liiift.studio)
