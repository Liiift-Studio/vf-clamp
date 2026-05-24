# vf-clamp — Claude Code Configuration

## Purpose

`@liiift-studio/vf-clamp` is the **delivery layer for per-purchase micro-VFs**.

Foundries license typefaces per-instance. A customer who buys specific named instances
should receive a variable font scoped to exactly those instances — not the full family,
not a predefined subfamily. vf-clamp generates that file at purchase/delivery time.

**Not subfamilies. Instance ranges.**

---

## Core Concepts

- **Instance hull**: the min/max of each axis across the selected named instances.
  Two instances at wght=300 and wght=700 produce a hull of wght [300, 700].
- **Axis pin**: when all selected instances share the same value on an axis, that axis is
  pinned and removed from the output design space (static, not variable on that axis).
- **Micro-VF**: a variable font whose design space is restricted to exactly the purchased
  range. The name table (family, full name, PostScript name) reflects this range.

---

## npm Package API (`@liiift-studio/vf-clamp`)

```ts
import { clampFont, getInstances } from '@liiift-studio/vf-clamp'

// Get all axes and named instances from a font
const { axes, instances } = await getInstances(fontBuffer)
// axes: [{ tag, name, minimum, default, maximum }]
// instances: [{ name, coordinates: { wght: 300, wdth: 100, ... } }]

// Produce restricted VFs
const results = await clampFont(fontBuffer, {
  outputs: [
    { name: 'Light-Bold', instances: ['Light', 'Bold'] },
    { name: 'Condensed', axes: { wdth: { min: 50, max: 75 } } },
  ],
  format: 'ttf', // 'ttf' | 'otf' | 'woff' | 'woff2'
})
// results: [{ name: string, buffer: Uint8Array, format: string }]
```

**OutputConfig**:
- `name` — label used as filename stem and written into name table
- `instances` — named instances to hull; hull derived automatically
- `axes` — explicit axis constraints; number = pin, { min, max } = range

**Implementation detail**: wraps `fonttools varLib.instancer` via Pyodide (WASM Python).
Node.js only — requires Node FS APIs. Cold start ~10–20s, warm ~1–2s.
Must be in `serverExternalPackages` when used in Next.js to prevent webpack bundling.

---

## Name Table Patching

After restricting the design space, vf-clamp patches the output font's name table so the
delivered file is identifiable as the purchased range:

| nameID | Field              | Value                    |
|--------|--------------------|--------------------------|
| 1      | Family             | output.name (e.g. "Encode Sans Light-Bold") |
| 4      | Full name          | same                     |
| 6      | PostScript name    | no-space ASCII (e.g. "Encode-Sans-Light-Bold") |
| 16     | Preferred family   | same as 1 (if present)   |
| 25     | Variations PS prefix | same as 6 (if present) |

nameIDs 2 (Subfamily), 3 (Unique ID), 5 (Version), 7–14 (legal/designer) are NOT changed.

---

## Repository Layout

```
vf-clamp/
├── src/core/clamp.ts       # clampFont() — main entry point
├── src/core/instances.ts   # getInstances() — reads fvar/name tables
├── src/core/types.ts       # public TypeScript types
├── dist/                   # built ESM + CJS output
├── site/                   # vfclamp.com Next.js site + demo UI
│   └── src/
│       ├── app/api/demo/   # unauthenticated demo routes
│       ├── components/Demo.tsx  # interactive demo component
│       └── lib/            # server utilities
├── plugins/                # plugin submodules (see below)
│   ├── cli/                → Liiift-Studio/vf-clamp-cli
│   ├── glyphs/             → Liiift-Studio/vf-clamp-glyphs
│   ├── robofont/           → Liiift-Studio/vf-clamp-robofont
│   └── vscode/             → Liiift-Studio/vf-clamp-vscode
└── fixtures/
    └── Inter-Variable.ttf  # test font (wght 100–900, slnt -10–0)
```

---

## Plugin Ecosystem

Each plugin lives in its own repo under `plugins/` as a git submodule.
All plugins expose the same core capability: **given a variable font and a set of
named instances, produce one or more restricted VF files with correct name tables**.

Plugin CLAUDE.md files inherit this document by directory traversal when working
inside the vf-clamp parent repo checkout.

### Plugin tech stacks

| Plugin | Language | Runtime | Distribution |
|--------|----------|---------|--------------|
| `cli`      | TypeScript | Node.js | npm (`@liiift-studio/vf-clamp-cli`) |
| `glyphs`   | Python     | Glyphs.app built-in Python 3 + fonttools | `.glyphsPlugin` zip |
| `robofont` | Python     | RoboFont built-in Python 3 + fonttools | `.roboFontExt` zip |
| `vscode`   | TypeScript | VS Code extension host (Node.js) | VS Code Marketplace |

### Python plugins — direct fonttools (no npm)

Glyphs and RoboFont plugins do NOT use the npm package or Pyodide.
fonttools is bundled with both apps. Call varLib.instancer directly:

```python
from fontTools.varLib import instancer
from fontTools.ttLib import TTFont
import io, re

def compute_hull(font, selected_names):
    fvar = font['fvar']
    name_table = font['name']
    all_insts = {
        name_table.getDebugName(inst.subfamilyNameID): inst.coordinates
        for inst in fvar.instances
    }
    hull = {}
    for name in selected_names:
        for tag, val in all_insts[name].items():
            if tag not in hull:
                hull[tag] = [val, val]
            else:
                hull[tag][0] = min(hull[tag][0], val)
                hull[tag][1] = max(hull[tag][1], val)
    result = {}
    for tag, (lo, hi) in hull.items():
        result[tag] = lo if lo == hi else instancer.AxisRange(lo, hi)
    return result

def patch_name_table(font, family_name):
    ps_name = re.sub(r'[^A-Za-z0-9-]', '', family_name.replace(' ', '-'))
    name_table = font['name']
    existing_ids = {r.nameID for r in name_table.names}
    updates = {1: family_name, 4: family_name, 6: ps_name}
    if 16 in existing_ids: updates[16] = family_name
    if 25 in existing_ids: updates[25] = ps_name
    for record in name_table.names:
        if record.nameID not in updates: continue
        value = updates[record.nameID]
        if record.platformID == 3:
            record.string = value.encode('utf-16-be')
        elif record.platformID == 1:
            try: record.string = value.encode('mac_roman')
            except: record.string = value.encode('ascii', errors='replace')

def clamp_and_patch(font_path, selected_names, output_name, output_path):
    font = TTFont(font_path)
    hull = compute_hull(font, selected_names)
    partial = instancer.instantiateVariableFont(font, hull)
    patch_name_table(partial, output_name)
    partial.save(output_path)
```

---

## Coding Standards

- **Indentation**: tabs
- **Comments**: one-line summary at top of each file; comment every function
- **Constants**: ALL_CAPS
- **No extra abstractions**: solve the problem directly; don't design for hypotheticals
- **Test fonts**: use Inter Variable (wght 100–900, slnt -10–0) — freely available from
  Google Fonts. The fixture at `fixtures/Inter-Variable.ttf` is available in this repo.

---

## Community — 10 Engineers to Contact If Stuck

| Engineer | Area | Contact |
|----------|------|---------|
| Behdad Esfahbod | fonttools creator | @behdad on GitHub |
| Cosimo Lupo | fonttools core maintainer | @anthrotype on GitHub |
| Georg Seifert | Glyphs.app developer | glyphsapp.com/forum |
| Rainer Scheichelbauer | Glyphs scripting expert | @mekkablue on GitHub / forum |
| Frederik Berlaen | RoboFont developer | @typemytype on GitHub |
| Erik van Blokland | Type tooling expert | @letterror on GitHub |
| Simon Cozens | fonttools, font engineering | @simoncozens on GitHub |
| Dave Crossland | Google Fonts, libre fonts | @davelab6 on GitHub |
| Frank Grießhammer | Adobe type tooling | @frankrolf on GitHub |
| Yanone | Type + tooling (Python/JS) | @yanone on GitHub |
