// src/core/clamp.ts — clampFont() implementation wrapping @web-alchemy/fonttools
import { createRequire } from 'node:module'
import type { AxisValue, AxisDefinition, ClampOptions, ClampResult, FontInstance, OutputFormat } from './types.js'
import { convertToWoff, convertToWoff2 } from './convert.js'
import { getInstances } from './instances.js'

// Access preparePyodide and PyodideFile from the shared @web-alchemy/fonttools singleton
const _require = createRequire(import.meta.url)
const { preparePyodide, PyodideFile } = _require('@web-alchemy/fonttools/src/pyodide.js')

/** Cached Python name-patcher function — initialised once, reused across calls */
let _namePatcherFn: ((fileOptions: Map<string, string>) => void) | null = null
/** Cached Python instancer — passes axis specs as JSON to avoid Pyodide array-bridging issues */
let _instancerFn: ((fileOptions: Map<string, string>, axesJson: string) => void) | null = null
/** Cached Python wght normalizer — remaps the wght axis to CSS 100–900 range */
let _normalizerFn: ((fileOptions: Map<string, string>, newMin: string) => void) | null = null

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

/**
 * Custom Python instancer. Axis specs are JSON-serialised so Pyodide receives plain
 * Python dicts/lists — avoiding the JsProxy type-bridging bug in the @web-alchemy
 * wrapper, which caused the instancer to receive JS arrays instead of AxisTriple
 * objects and produce wrong fvar axis coordinates.
 */
async function getInstancer() {
	if (_instancerFn) return _instancerFn
	const pyodide = await preparePyodide()
	_instancerFn = await pyodide.runPythonAsync(`
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
import json

def vf_clamp_instantiate(file_options, axes_json):
    font = TTFont(file_options['input-file'])
    axes_spec = json.loads(axes_json)

    limits = {}
    axes_by_tag = {ax.axisTag: ax for ax in font['fvar'].axes}

    for tag, spec in axes_spec.items():
        if spec is None:
            continue
        ax = axes_by_tag.get(tag)
        if isinstance(spec, list):
            mn = float(spec[0])
            mx = float(spec[1])
            default = ax.defaultValue if ax else (mn + mx) / 2
            default = max(mn, min(mx, default))
            limits[tag] = instancer.AxisTriple(mn, default, mx)
        else:
            limits[tag] = float(spec)

    partial = instancer.instantiateVariableFont(font, limits)
    partial.save(file_options['output-file'])

vf_clamp_instantiate
`)
	return _instancerFn!
}

/**
 * Remap the wght axis so its minimum becomes new_min (default 100), making CSS
 * font-weight values work as expected for fonts whose design space starts above 100.
 *
 * Technique: proportionally remap all below-default coordinates so their normalised
 * value is preserved. The avar table requires no changes because normalised values
 * are unchanged. Only fvar min, instance coordinates, and STAT axis values are updated.
 */
async function getNormalizer() {
	if (_normalizerFn) return _normalizerFn
	const pyodide = await preparePyodide()
	_normalizerFn = await pyodide.runPythonAsync(`
from fontTools.ttLib import TTFont

def vf_clamp_normalize_wght(file_options, new_min_str):
    new_min = float(new_min_str)
    font = TTFont(file_options['input-file'])

    if 'fvar' not in font:
        font.save(file_options['output-file'])
        return

    wght_axis = next((ax for ax in font['fvar'].axes if ax.axisTag == 'wght'), None)

    # Only normalize when the font's minimum is above the target (e.g. 251 > 100)
    if wght_axis is None or wght_axis.minValue <= new_min:
        font.save(file_options['output-file'])
        return

    old_min = wght_axis.minValue
    default = wght_axis.defaultValue
    scale = (default - new_min) / (default - old_min)

    def remap(v):
        return (default + (v - default) * scale) if v < default else v

    # Update fvar axis minimum
    wght_axis.minValue = new_min

    # Update named instance wght coordinates
    for inst in font['fvar'].instances:
        if 'wght' in inst.coordinates:
            inst.coordinates['wght'] = remap(inst.coordinates['wght'])

    # Update STAT axis values that reference wght
    if 'STAT' in font and font['STAT'].table.AxisValueArray:
        stat = font['STAT'].table
        wght_idx = None
        if hasattr(stat, 'DesignAxisRecord') and stat.DesignAxisRecord:
            for i, ax in enumerate(stat.DesignAxisRecord.Axis):
                if ax.AxisTag == 'wght':
                    wght_idx = i
                    break
        if wght_idx is not None:
            for av in stat.AxisValueArray.AxisValue:
                fmt = av.Format
                if fmt in (1, 3) and av.AxisIndex == wght_idx:
                    av.Value = remap(av.Value)
                    if fmt == 3:
                        av.LinkedValue = remap(av.LinkedValue)
                elif fmt == 2 and av.AxisIndex == wght_idx:
                    av.NominalValue = remap(av.NominalValue)
                    av.RangeMinValue = remap(av.RangeMinValue)
                    av.RangeMaxValue = remap(av.RangeMaxValue)

    font.save(file_options['output-file'])

vf_clamp_normalize_wght
`)
	return _normalizerFn!
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

/** Convert a vf-clamp AxisValue to a JSON-serialisable form for the Python instancer */
function toInstancerValue(value: AxisValue): number | [number, number] | null {
	if (typeof value === 'number') return value
	if (value === null) return null
	return [value.min, value.max]
}

/** Run the Python instancer via Pyodide, passing axis specs as JSON to avoid bridging issues */
async function runInstancer(bytes: Uint8Array | Buffer, instancerAxes: Record<string, number | [number, number] | null>): Promise<Uint8Array> {
	const pyodide = await preparePyodide()
	const inputFile  = new PyodideFile({ pyodide })
	const outputFile = new PyodideFile({ pyodide })

	await inputFile.upload(bytes)

	const fileOptions = new Map([
		['input-file',  inputFile.filename],
		['output-file', outputFile.filename],
	])

	const fn = await getInstancer()
	fn(fileOptions, JSON.stringify(instancerAxes))

	const result = outputFile.download()
	inputFile.delete()
	outputFile.delete()
	return result as Uint8Array
}

/** Remap the wght axis minimum to newMin, preserving normalised values throughout */
async function runNormalizer(bytes: Uint8Array, newMin: number): Promise<Uint8Array> {
	try {
		const pyodide = await preparePyodide()
		const inputFile  = new PyodideFile({ pyodide })
		const outputFile = new PyodideFile({ pyodide })

		await inputFile.upload(bytes)

		const fileOptions = new Map([
			['input-file',  inputFile.filename],
			['output-file', outputFile.filename],
		])

		const fn = await getNormalizer()
		fn(fileOptions, String(newMin))

		const result = outputFile.download()
		inputFile.delete()
		outputFile.delete()
		return result as Uint8Array
	} catch {
		return bytes
	}
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

		let buffer = await runInstancer(bytes, instancerAxes)

		// Optionally remap wght axis to CSS 100–900 range
		if (options.normalizeWeightAxis) {
			buffer = await runNormalizer(buffer, 100)
		}

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
