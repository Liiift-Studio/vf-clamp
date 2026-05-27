// src/core/pyodide.ts — re-exports preparePyodide and PyodideFile from the @web-alchemy/fonttools CJS singleton
// Isolated here so tests can mock this ESM boundary without needing to intercept createRequire.
import { createRequire } from 'node:module'

const _require = createRequire(import.meta.url)
const { preparePyodide, PyodideFile } = _require('@web-alchemy/fonttools/src/pyodide.js')

export { preparePyodide, PyodideFile }
