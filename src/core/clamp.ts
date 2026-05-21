// src/core/clamp.ts — clampFont() implementation wrapping @web-alchemy/fonttools
import { instantiateVariableFont } from '@web-alchemy/fonttools'
import type { AxisValue, ClampOptions, ClampResult } from './types.js'

/** Convert a vf-clamp AxisValue to the format expected by @web-alchemy/fonttools */
function toInstancerValue(value: AxisValue): number | [number, number] | null {
	if (value === null) return null
	if (typeof value === 'number') return value
	return [value.min, value.max]
}

/**
 * Produce one restricted variable font per subfamily config from a source VF.
 * Subfamilies are processed sequentially (Pyodide is single-threaded).
 *
 * @param input - Source variable font binary (TTF)
 * @param options - Subfamily configs defining which axes to clamp
 * @returns One ClampResult per subfamily, in the same order as options.subfamilies
 */
export async function clampFont(
	input: ArrayBuffer | Uint8Array | Buffer,
	options: ClampOptions
): Promise<ClampResult[]> {
	if (options.subfamilies.length === 0) return []

	const results: ClampResult[] = []

	for (const subfamily of options.subfamilies) {
		const instancerAxes: Record<string, number | [number, number] | null> = {}

		for (const [tag, value] of Object.entries(subfamily.axes)) {
			instancerAxes[tag] = toInstancerValue(value)
		}

		const buffer = await instantiateVariableFont(input, instancerAxes)
		results.push({ name: subfamily.name, buffer })
	}

	return results
}
