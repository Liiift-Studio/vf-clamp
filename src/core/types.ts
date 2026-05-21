// src/core/types.ts — public types for vf-clamp

/** Pin an axis at a single value — the axis is locked and removed from the output font's design space */
export type PinnedAxis = number

/** Restrict an axis to a sub-range — the axis remains variable but clamped to [min, max] */
export interface AxisRange {
	/** Minimum value on the axis */
	min: number
	/** Maximum value on the axis */
	max: number
}

/**
 * What to do with one axis when clamping a variable font:
 * - number: pin to that value (axis removed from output)
 * - AxisRange: restrict to [min, max] (axis stays variable within that range)
 * - null: drop the axis entirely (uses its current default value)
 *
 * Axes omitted from the config keep their full original range.
 */
export type AxisValue = PinnedAxis | AxisRange | null

/** One subfamily variant to produce from the source variable font */
export interface SubfamilyConfig {
	/** Identifier for this variant, e.g. "Condensed" or "SemiCondensed" */
	name: string
	/**
	 * Map of axis tag → value.
	 * Axis tags not listed here keep their full range from the source font.
	 */
	axes: Record<string, AxisValue>
}

/** Options passed to clampFont() */
export interface ClampOptions {
	/** One entry per restricted variant to produce */
	subfamilies: SubfamilyConfig[]
}

/** One output from clampFont() — a restricted variable font for a single subfamily */
export interface ClampResult {
	/** Matches the SubfamilyConfig name */
	name: string
	/** Restricted font binary — write to .ttf or pass to a WOFF2 encoder */
	buffer: Uint8Array
}
