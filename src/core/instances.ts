// src/core/instances.ts — extract named instances and axis definitions from a variable font
import { preparePyodide, PyodideFile } from './pyodide.js'
import type { FontInstancesResult } from './types.js'

/**
 * Promise-singleton cache for the Python instances function — compiled once per process.
 * Concurrent callers await the same Promise instead of racing to issue multiple
 * runPythonAsync calls against the Pyodide singleton.
 */
let _instancesFnP: Promise<(inputFile: string) => string> | null = null

/** Return the cached Python instances function, compiling it on first call. */
async function getInstancesFn() {
	if (!_instancesFnP) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		_instancesFnP = preparePyodide().then((pyodide: any) =>
			pyodide.runPythonAsync(`
import json
from fontTools.ttLib import TTFont

def get_instances_fn(input_file):
    font = TTFont(input_file)

    if 'fvar' not in font:
        return json.dumps({'axes': [], 'instances': []})

    fvar = font['fvar']
    name_table = font['name']

    axes = [
        {
            'tag': ax.axisTag,
            'name': name_table.getDebugName(ax.axisNameID) or ax.axisTag,
            'minimum': ax.minValue,
            'default': ax.defaultValue,
            'maximum': ax.maxValue,
        }
        for ax in fvar.axes
    ]

    instances = [
        {
            'name': name_table.getDebugName(inst.subfamilyNameID) or f'Instance {i}',
            'coordinates': dict(inst.coordinates),
        }
        for i, inst in enumerate(fvar.instances)
    ]

    return json.dumps({'axes': axes, 'instances': instances})

get_instances_fn
`)
		)
	}
	return _instancesFnP!
}

/**
 * Extract axis definitions and named instances from a variable font's fvar table.
 * Returns the full design space: which axes exist and what named positions are defined.
 * Accepts TTF, OTF, WOFF, or WOFF2 input — fonttools handles all four formats.
 *
 * @param input - Source variable font binary (TTF, OTF, WOFF, or WOFF2)
 * @returns Axis definitions and named instances, or empty arrays for a static font
 */
export async function getInstances(
	input: ArrayBuffer | Uint8Array | Buffer
): Promise<FontInstancesResult> {
	const pyodide = await preparePyodide()
	const bytes: Uint8Array | Buffer =
		input instanceof ArrayBuffer ? new Uint8Array(input) : input

	const file = new PyodideFile({ pyodide })
	try {
		await file.upload(bytes)
		const fn = await getInstancesFn()
		const jsonStr: string = fn(file.filename)
		return JSON.parse(jsonStr)
	} finally {
		try { file.delete() } catch { /* already cleaned */ }
	}
}
