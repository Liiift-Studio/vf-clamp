// src/core/clamp.ts — clampFont() implementation wrapping @web-alchemy/fonttools
import { createRequire } from 'node:module'
import { instantiateVariableFont } from '@web-alchemy/fonttools'
import type { AxisValue, AxisDefinition, ClampOptions, ClampResult, FontInstance, OutputFormat } from './types.js'
import { convertToWoff, convertToWoff2 } from './convert.js'
import { getInstances } from './instances.js'

// Access preparePyodide and PyodideFile from the shared @web-alchemy/fonttools singleton
const _require = createRequire(import.meta.url)
const { preparePyodide, PyodideFile } = _require('@web-alchemy/fonttools/src/pyodide.js')

/** Cached Python name-patcher function — initialised once, reused across calls */
let _namePatcherFn: ((fileOptions: Map<string, string>) => void) | null = null

async function getNamePatcher() {
	if (_namePatcherFn) return _namePatcherFn
	const pyodide = await preparePyodide()
	_namePatcherFn = await pyodide.runPythonAsync(`
from fontTools import ttLib

def patch_font_names_fn(file_options):
    font = ttLib.TTFont(file_options['input-file'])
    name_table = font['name']
    family_name  = file_options['family-name']
    ps_name      = file_options['postscript-name']

    existing_ids = {r.nameID for r in name_table.names}

    # nameID 1 = Family, 4 = Full name, 6 = PostScript name
    # nameID 16 = Preferred family (update only if present)
    # nameID 25 = Variations PS Name Prefix (update only if present)
    updates = {1: family_name, 4: family_name, 6: ps_name}
    if 16 in existing_ids:
        updates[16] = family_name
    if 25 in existing_ids:
        updates[25] = ps_name

    for record in name_table.names:
        if record.nameID not in updates:
            continue
        value = updates[record.nameID]
        if record.platformID == 3:
            record.string = value.encode('utf-16-be')
        elif record.platformID == 1:
            try:
                record.string = value.encode('mac_roman')
            except Exception:
                record.string = value.encode('ascii', errors='replace')

    font.save(file_options['output-file'])

patch_font_names_fn
`)
	return _namePatcherFn!
}

/** Convert a human-readable family name to a valid PostScript name (no spaces, ASCII only) */
function toPostScriptName(familyName: string): string {
	return familyName
		.replace(/[^A-Za-z0-9 -]/g, '')
		.trim()
		.split(/\s+/)
		.join('-')
		.replace(/^-+|-+$/g, '')
}

/**
 * Patch the name table of a font buffer to reflect the restricted instance range.
 * Updates nameIDs 1 (Family), 4 (Full name), 6 (PostScript), 16 and 25 if present.
 * Falls back to the original buffer if patching fails.
 */
async function patchFontNames(buffer: Uint8Array, familyName: string): Promise<Uint8Array> {
	if (!familyName) return buffer
	try {
		const psName = toPostScriptName(familyName)
		const pyodide = await preparePyodide()

		const inputFile = new PyodideFile({ pyodide })
		const outputFile = new PyodideFile({ pyodide })

		await inputFile.upload(buffer)

		const fileOptions = new Map([
			['input-file', inputFile.filename],
			['output-file', outputFile.filename],
			['family-name', familyName],
			['postscript-name', psName],
		])

		const patcher = await getNamePatcher()
		patcher(fileOptions)

		const result = outputFile.download()
		inputFile.delete()
		outputFile.delete()

		return result as Uint8Array
	} catch {
		return buffer
	}
}

/** Convert a vf-clamp AxisValue to the format expected by @web-alchemy/fonttools */
function toInstancerValue(value: AxisValue): number | [number, number] | null {
	if (typeof value === 'number') return value
	if (value === null) return null
	return [value.min, value.max]
}

/**
 * Compute the axis hull (min/max per axis) across a set of named instances.
 * Axes where min === max are returned as a pinned number; varying axes as an AxisRange.
 * Throws if any instance name is not found in the font.
 */
function computeHull(
	requestedNames: string[],
	fontInstances: FontInstance[],
): Record<string, AxisValue> {
	const hull: Record<string, { min: number; max: number }> = {}

	for (const name of requestedNames) {
		const inst = fontInstances.find((i) => i.name === name)
		if (!inst) throw new Error(`Named instance "${name}" not found in font`)

		for (const [tag, val] of Object.entries(inst.coordinates)) {
			if (!hull[tag]) hull[tag] = { min: val, max: val }
			else {
				hull[tag].min = Math.min(hull[tag].min, val)
				hull[tag].max = Math.max(hull[tag].max, val)
			}
		}
	}

	const result: Record<string, AxisValue> = {}
	for (const [tag, { min, max }] of Object.entries(hull)) {
		result[tag] = min === max ? min : { min, max }
	}
	return result
}

/**
 * Produce one restricted variable font per output config from a source variable font.
 * Outputs are processed sequentially (Pyodide is single-threaded).
 *
 * Each output can specify:
 * - instances: named instances to include — hull (min/max per axis) computed automatically
 * - axes: explicit axis constraints — override or extend the instance hull
 *
 * @param input - Source variable font binary (TTF, OTF, WOFF, or WOFF2)
 * @param options - Output configs and optional format
 * @returns One ClampResult per output, in the same order as options.outputs
 */
export async function clampFont(
	input: ArrayBuffer | Uint8Array | Buffer,
	options: ClampOptions
): Promise<ClampResult[]> {
	if (options.outputs.length === 0) return []

	// Pyodide's FS.writeFile requires Uint8Array or Buffer, not a raw ArrayBuffer.
	const bytes: Uint8Array | Buffer =
		input instanceof ArrayBuffer ? new Uint8Array(input) : input

	const format: OutputFormat = options.format ?? 'ttf'

	// Read named instances once if any output uses the instances path
	let fontInstances: FontInstance[] = []
	let axisDefs: AxisDefinition[] = []
	if (options.outputs.some((o) => o.instances?.length)) {
		const result = await getInstances(bytes)
		fontInstances = result.instances
		axisDefs = result.axes
	}

	const results: ClampResult[] = []

	for (const output of options.outputs) {
		// Start with instance hull if instances provided, then layer explicit axes on top
		let axesConfig: Record<string, AxisValue> = {}

		if (output.instances?.length) {
			axesConfig = computeHull(output.instances, fontInstances)
		}

		if (output.axes) {
			axesConfig = { ...axesConfig, ...output.axes }
		}

		// Warn if any axis default falls outside the restricted range — fonttools silently clamps it.
		// Only checked when axisDefs are available (i.e., getInstances was already called).
		for (const axDef of axisDefs) {
			const constraint = axesConfig[axDef.tag]
			if (constraint !== null && constraint !== undefined && typeof constraint === 'object') {
				const range = constraint as { min: number; max: number }
				if (axDef.default < range.min || axDef.default > range.max) {
					const clamped = Math.max(range.min, Math.min(range.max, axDef.default))
					console.warn(
						`vf-clamp: axis "${axDef.tag}" default (${axDef.default}) is outside restricted range [${range.min}, ${range.max}] — will be clamped to ${clamped}`
					)
				}
			}
		}

		// Build the instancer axis map (skip null — keeps full range)
		const instancerAxes: Record<string, number | [number, number] | null> = {}
		for (const [tag, value] of Object.entries(axesConfig)) {
			if (value !== null) instancerAxes[tag] = toInstancerValue(value)
		}

		// Derive name before patching so the name table reflects it
		const name = output.name ??
			(output.instances?.length
				? output.instances.length === 1
					? output.instances[0]
					: `${output.instances[0]}–${output.instances[output.instances.length - 1]}`
				: 'output')

		let buffer = await instantiateVariableFont(bytes, instancerAxes)

		// Update the name table so the restricted font reflects its actual instance range
		buffer = await patchFontNames(buffer, name)

		if (format === 'woff2') {
			buffer = await convertToWoff2(buffer)
		} else if (format === 'woff') {
			buffer = await convertToWoff(buffer)
		}

		results.push({ name, buffer, format })
	}

	return results
}
