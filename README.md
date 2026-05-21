# vf-clamp

Restrict a variable font's axis ranges to a specific subfamily scope — like CSS `clamp()` for design space.

```
npm install vf-clamp
```

---

## What it does

Takes a variable font (TTF) and produces one restricted variant per configured subfamily. Each variant is a valid variable font with unused axis ranges trimmed, gvar deltas pruned, and STAT records updated. No Python required — powered by [fonttools](https://github.com/fonttools/fonttools) compiled to WASM via [Pyodide](https://pyodide.org).

---

## Usage

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

    // Mixed: pin width, keep full weight range (omit wght entirely)
    { name: 'Narrow', axes: { wdth: 62.5 } },

    // Drop an axis entirely with null (uses its current default)
    { name: 'Upright', axes: { ital: null } },
  ],
})

for (const result of results) {
  await writeFile(`Omnes-${result.name}-VF.ttf`, result.buffer)
}
```

---

## Axis value types

| Value | Effect |
|---|---|
| `number` | Pin the axis to that value — axis is removed from the output |
| `{ min, max }` | Restrict to a range — axis stays variable within those bounds |
| `null` | Drop the axis entirely, fixing it at its current default |
| *(omitted)* | Keep the full original range — axis is unchanged |

---

## API

### `clampFont(input, options)`

```ts
async function clampFont(
  input: ArrayBuffer | Uint8Array | Buffer,
  options: ClampOptions
): Promise<ClampResult[]>
```

**Parameters**

- `input` — Source variable font binary (TTF). Use the original source TTF, not WOFF/WOFF2.
- `options.subfamilies` — Array of `SubfamilyConfig` entries, one per output variant.

**Returns**

Array of `ClampResult` in the same order as `options.subfamilies`:

```ts
interface ClampResult {
  name: string       // matches SubfamilyConfig.name
  buffer: Uint8Array // restricted TTF binary
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
  subfamilies: SubfamilyConfig[]
}
```

---

## Notes

- **Pyodide cold start**: first call initialises the Python WASM runtime (~2–4s). Subsequent calls in the same process reuse it.
- **Input format**: use the source TTF, not WOFF2. The instancer works on TTF/OTF.
- **Subfamilies are processed sequentially** — Pyodide is single-threaded.
- **No zopfli**: WOFF2 compression uses standard zlib. Convert the output TTF to WOFF2 separately with your preferred tool.

---

## REST API

vfclamp.com also exposes a hosted endpoint. Useful for server-side workflows where the font is fetched by URL rather than loaded from disk.

```
POST https://vfclamp.com/api/clamp
X-API-Key: <your-key>
Content-Type: application/json

{
  "fontUrl": "https://cdn.example.com/MyFont-VF.ttf",
  "subfamilies": [
    { "name": "Condensed", "axes": { "wdth": 75 } }
  ]
}
```

Response:

```json
{
  "results": [
    {
      "name": "Condensed",
      "data": "<base64-encoded TTF>",
      "size": 123456
    }
  ]
}
```

---

## License

MIT — [Liiift Studio](https://liiift.studio)
