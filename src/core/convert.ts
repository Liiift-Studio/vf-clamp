// src/core/convert.ts — WOFF and WOFF2 conversion via fonttools/Pyodide
import { createRequire } from 'node:module'

const _require = createRequire(import.meta.url)
const { preparePyodide, PyodideFile } = _require('@web-alchemy/fonttools/src/pyodide.js')

/** Convert any font buffer to a given web format ('woff' or 'woff2') using fonttools. */
async function convertToFlavor(input: Uint8Array | Buffer, flavor: 'woff' | 'woff2'): Promise<Uint8Array> {
	const pyodide = await preparePyodide()
	const file = new PyodideFile({ pyodide })
	await file.upload(input)

	const inputPath: string = file.filename
	const outputPath = `${inputPath}.${flavor}`

	await pyodide.runPythonAsync(`
from fontTools.ttLib import TTFont
font = TTFont('${inputPath}')
font.flavor = '${flavor}'
font.save('${outputPath}')
`)

	const result: Uint8Array = pyodide.FS.readFile(outputPath)
	file.delete()
	try { pyodide.FS.unlink(outputPath) } catch { /* already cleaned */ }

	return result
}

/** Convert a font buffer to WOFF (zlib-compressed). */
export async function convertToWoff(input: Uint8Array | Buffer): Promise<Uint8Array> {
	return convertToFlavor(input, 'woff')
}

/** Convert a font buffer to WOFF2 (Brotli-compressed). */
export async function convertToWoff2(input: Uint8Array | Buffer): Promise<Uint8Array> {
	return convertToFlavor(input, 'woff2')
}
