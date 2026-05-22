// src/index.ts — public API for vf-clamp
export { clampFont } from './core/clamp.js'
export { getInstances } from './core/instances.js'
export { convertToWoff2 } from './core/convert.js'
export type {
	AxisValue,
	AxisRange,
	PinnedAxis,
	OutputFormat,
	SubfamilyConfig,
	ClampOptions,
	ClampResult,
	AxisDefinition,
	FontInstance,
	FontInstancesResult,
} from './core/types.js'
