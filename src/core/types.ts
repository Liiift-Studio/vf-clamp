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
 * - number: pin to that value (axis locked and removed from output design space)
 * - AxisRange: restrict to [min, max] (axis stays variable within that range)
 * - null: omit this axis from the instancer call — axis keeps its full original range
 *
 * Axes not listed in the config also keep their full original range.
 * Note: JS→Python bridge limitations prevent true axis dropping (fonttools' Python `None` semantic).
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

/** One axis defined in the font's fvar table */
export interface AxisDefinition {
	/** Four-character axis tag, e.g. "wght", "wdth" */
	tag: string
	/** Human-readable axis name from the font's name table */
	name: string
	/** Minimum value on the axis */
	minimum: number
	/** Default value (used when axis is not explicitly set) */
	default: number
	/** Maximum value on the axis */
	maximum: number
}

/** One named instance from the font's fvar table */
export interface FontInstance {
	/** Instance name from the font's name table, e.g. "Regular", "Bold Condensed" */
	name: string
	/** Axis coordinates for this instance, e.g. { wght: 400, wdth: 100 } */
	coordinates: Record<string, number>
}

/** Result of getInstances() — describes the full design space of a variable font */
export interface FontInstancesResult {
	/** All variable axes defined in the font */
	axes: AxisDefinition[]
	/** All named instances defined in the font */
	instances: FontInstance[]
}
