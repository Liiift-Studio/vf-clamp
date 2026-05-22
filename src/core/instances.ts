// src/core/instances.ts — extract named instances and axis definitions from a variable font
import { createRequire } from 'node:module'
import type { FontInstancesResult } from './types.js'

// Access preparePyodide and PyodideFile from the internal @web-alchemy/fonttools module
// (same singleton Pyodide instance shared with clampFont)
const _require = createRequire(import.meta.url)
const { preparePyodide, PyodideFile } = _require('@web-alchemy/fonttools/src/pyodide.js')

async function getPythonInstancesFunction(pyodide: any) {
	return pyodide.runPythonAsync(`
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
}

/**
 * Extract axis definitions and named instances from a variable font's fvar table.
 * Returns the full design space: which axes exist and what named positions are defined.
 *
 * @param input - Source variable font binary (TTF)
 * @returns Axis definitions and named instances, or empty arrays for a static font
 */
export async function getInstances(
	input: ArrayBuffer | Uint8Array | Buffer
): Promise<FontInstancesResult> {
	const pyodide = await preparePyodide()
	const bytes: Uint8Array | Buffer =
		input instanceof ArrayBuffer ? new Uint8Array(input) : input

	const file = new PyodideFile({ pyodide })
	await file.upload(bytes)

	const fn = await getPythonInstancesFunction(pyodide)
	const jsonStr: string = fn(file.filename)
	file.delete()

	return JSON.parse(jsonStr)
}
