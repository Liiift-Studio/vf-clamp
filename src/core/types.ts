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

/**
 * One output variant to produce from the source variable font.
 * Specify instances, axes, or both — instances set the hull, axes override individual tags.
 */
export interface OutputConfig {
	/** Name for this output — used in ClampResult.name. Defaults to instance range when omitted. */
	name?: string
	/**
	 * Named instances to include. The axis hull (min/max per axis) is computed automatically
	 * across all listed instances — producing one variable font that spans exactly that range.
	 * Instance names must match the font's fvar name table exactly.
	 */
	instances?: string[]
	/**
	 * Explicit axis constraints, applied after any instance hull.
	 * Axes listed here override the hull computed from instances for that tag.
	 * Axis tags not listed keep their full original range.
	 */
	axes?: Record<string, AxisValue>
}

/** Options passed to clampFont() */
export interface ClampOptions {
	/** One entry per restricted variant to produce */
	outputs: OutputConfig[]
	/**
	 * Output format — defaults to 'ttf'.
	 * 'woff' and 'woff2' transcode the result to a web-compressed flavour.
	 * 'otf' is a passthrough — the instancer preserves the input outline format.
	 */
	format?: OutputFormat
}

/**
 * Output format for clampFont() — defaults to 'ttf'.
 * 'woff' and 'woff2' transcode to web-compressed flavours.
 * 'otf' is a passthrough (no outline conversion); the instancer preserves the input flavour.
 */
export type OutputFormat = 'ttf' | 'otf' | 'woff' | 'woff2'

/** One output from clampFont() — a restricted variable font for a single output config */
export interface ClampResult {
	/** Matches OutputConfig.name (or the auto-derived instance range if name was omitted) */
	name: string
	/** Restricted font binary — write to disk or upload; format matches options.format */
	buffer: Uint8Array
	/** Format of the buffer — matches options.format, defaults to 'ttf' */
	format: OutputFormat
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

/** @deprecated Use OutputConfig instead */
export type SubfamilyConfig = OutputConfig
