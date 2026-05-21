// src/web-alchemy-fonttools.d.ts — type declarations for @web-alchemy/fonttools (no bundled types)
declare module '@web-alchemy/fonttools' {
	/**
	 * Restrict a variable font's axis ranges using fonttools varLib.instancer (via Pyodide WASM).
	 * First call initialises Pyodide (~2–4s); subsequent calls reuse the loaded runtime.
	 *
	 * @param input - Source variable font binary (TTF/OTF)
	 * @param axes - Axis tag → value map:
	 *   - number: pin to that value (axis removed)
	 *   - [min, max]: restrict to range (axis stays variable)
	 *   - null: drop axis entirely
	 *   - omitted: keep full range
	 */
	export function instantiateVariableFont(
		input: ArrayBuffer | Uint8Array | Buffer,
		axes: Record<string, number | [number, number] | null>
	): Promise<Uint8Array>
}
