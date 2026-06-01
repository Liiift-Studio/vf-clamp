// src/index.ts — public API for vf-clamp
export { clampFont } from './core/clamp.js'
export { getInstances } from './core/instances.js'
export { convertToWoff, convertToWoff2 } from './core/convert.js'
export { compactName } from './core/utils.js'
export type {
	AxisValue,
	AxisRange,
	PinnedAxis,
	OutputFormat,
	OutputConfig,
	ClampOptions,
	ClampResult,
	AxisDefinition,
	FontInstance,
	FontInstancesResult,
	SubfamilyConfig,
} from './core/types.js'
