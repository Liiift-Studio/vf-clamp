// src/core/convert.ts — WOFF and WOFF2 conversion via fonttools/Pyodide
import { preparePyodide, PyodideFile } from './pyodide.js'

/**
 * Promise-singleton cache for the Python conversion function — compiled once per process.
 * Uses a Map argument to pass file paths safely, avoiding template-literal injection.
 */
let _converterFnP: Promise<(fileOptions: Map<string, string>) => void> | null = null

/** Return the cached Python converter function, compiling it on first call. */
async function getConverter() {
	if (!_converterFnP) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		_converterFnP = preparePyodide().then((pyodide: any) =>
			pyodide.runPythonAsync(`
from fontTools.ttLib import TTFont

def vf_convert_flavor(file_options):
    font = TTFont(file_options['input-file'])
    font.flavor = file_options['flavor']
    font.save(file_options['output-file'])

vf_convert_flavor
`)
		)
	}
	return _converterFnP!
}

/** Convert any font buffer to a given web format ('woff' or 'woff2') using fonttools. */
async function convertToFlavor(input: Uint8Array | Buffer, flavor: 'woff' | 'woff2'): Promise<Uint8Array> {
	const pyodide = await preparePyodide()
	const inputFile  = new PyodideFile({ pyodide })
	const outputFile = new PyodideFile({ pyodide })
	try {
		await inputFile.upload(input)

		const fileOptions = new Map([
			['input-file',  inputFile.filename],
			['output-file', outputFile.filename],
			['flavor',      flavor],
		])

		const fn = await getConverter()
		fn(fileOptions)

		return outputFile.download() as Uint8Array
	} finally {
		try { inputFile.delete() } catch { /* already cleaned */ }
		try { outputFile.delete() } catch { /* already cleaned */ }
	}
}

/** Convert a font buffer to WOFF (zlib-compressed). */
export async function convertToWoff(input: Uint8Array | Buffer): Promise<Uint8Array> {
	return convertToFlavor(input, 'woff')
}

/** Convert a font buffer to WOFF2 (Brotli-compressed). */
export async function convertToWoff2(input: Uint8Array | Buffer): Promise<Uint8Array> {
	return convertToFlavor(input, 'woff2')
}
