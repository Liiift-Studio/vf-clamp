// src/core/clamp.ts — clampFont() implementation wrapping @web-alchemy/fonttools
import { instantiateVariableFont } from '@web-alchemy/fonttools'
import type { AxisValue, ClampOptions, ClampResult, OutputFormat } from './types.js'
import { convertToWoff2 } from './convert.js'

/** Convert a vf-clamp AxisValue to the format expected by @web-alchemy/fonttools */
function toInstancerValue(value: AxisValue): number | [number, number] | null {
	if (typeof value === 'number') return value
	if (value === null) return null
	return [value.min, value.max]
}

/**
 * Produce one restricted variable font per subfamily config from a source VF.
 * Subfamilies are processed sequentially (Pyodide is single-threaded).
 *
 * @param input - Source variable font binary (TTF)
 * @param options - Subfamily configs defining which axes to clamp, and optional output format
 * @returns One ClampResult per subfamily, in the same order as options.subfamilies
 */
export async function clampFont(
	input: ArrayBuffer | Uint8Array | Buffer,
	options: ClampOptions
): Promise<ClampResult[]> {
	if (options.subfamilies.length === 0) return []

	// Pyodide's FS.writeFile requires Uint8Array or Buffer, not a raw ArrayBuffer.
	// fetch().arrayBuffer() returns ArrayBuffer — normalise here so callers don't need to.
	const bytes: Uint8Array | Buffer =
		input instanceof ArrayBuffer ? new Uint8Array(input) : input

	const format: OutputFormat = options.format ?? 'ttf'
	const results: ClampResult[] = []

	for (const subfamily of options.subfamilies) {
		const instancerAxes: Record<string, number | [number, number] | null> = {}

		for (const [tag, value] of Object.entries(subfamily.axes)) {
			// null means "omit this axis" — skip it so the axis keeps its full range.
			// Passing JS null to Pyodide produces JsNull (not Python None) which fonttools rejects.
			if (value !== null) {
				instancerAxes[tag] = toInstancerValue(value)
			}
		}

		let buffer = await instantiateVariableFont(bytes, instancerAxes)

		if (format === 'woff2') {
			buffer = await convertToWoff2(buffer)
		}

		results.push({ name: subfamily.name, buffer, format })
	}

	return results
}
