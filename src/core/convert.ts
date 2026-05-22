// src/core/convert.ts — WOFF2 conversion via fonttools/Pyodide
import { createRequire } from 'node:module'

const _require = createRequire(import.meta.url)
const { preparePyodide, PyodideFile } = _require('@web-alchemy/fonttools/src/pyodide.js')

/** Convert a TTF/variable font buffer to WOFF2 using fonttools (Brotli already loaded by Pyodide init). */
export async function convertToWoff2(input: Uint8Array | Buffer): Promise<Uint8Array> {
	const pyodide = await preparePyodide()
	const file = new PyodideFile({ pyodide })
	await file.upload(input)

	const inputPath: string = file.filename
	const outputPath = `${inputPath}.woff2`

	await pyodide.runPythonAsync(`
from fontTools.ttLib import TTFont
font = TTFont('${inputPath}')
font.flavor = 'woff2'
font.save('${outputPath}')
`)

	const result: Uint8Array = pyodide.FS.readFile(outputPath)
	file.delete()
	try { pyodide.FS.unlink(outputPath) } catch { /* already cleaned */ }

	return result
}
