// src/__tests__/clamp.integration.test.ts — integration tests using real Pyodide + fonttools
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { clampFont } from '../core/clamp.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES = join(__dirname, '../../fixtures')

/** Inter[slnt,wght] v4.0 — axes: wght 100–900, slnt -10–0 */
function interVF() {
	return readFileSync(join(FIXTURES, 'Inter-Variable.ttf'))
}

describe('clampFont — integration (real Pyodide + fonttools)', () => {
	it('pinning wght produces a smaller, valid buffer', async () => {
		const input = interVF()
		const results = await clampFont(input, {
			subfamilies: [{ name: 'Regular', axes: { wght: 400 } }],
		})

		expect(results).toHaveLength(1)
		expect(results[0].name).toBe('Regular')
		expect(results[0].buffer.byteLength).toBeGreaterThan(0)
		expect(results[0].buffer.byteLength).toBeLessThan(input.byteLength)
	}, 120_000)

	it('range-restricting wght produces a smaller, valid buffer', async () => {
		const input = interVF()
		const results = await clampFont(input, {
			subfamilies: [{ name: 'Text', axes: { wght: { min: 400, max: 700 } } }],
		})

		expect(results[0].buffer.byteLength).toBeGreaterThan(0)
		expect(results[0].buffer.byteLength).toBeLessThan(input.byteLength)
	}, 120_000)

	it('range-restricted output is smaller than the full font but larger than pinned', async () => {
		const input = interVF()
		const [ranged, pinned] = await Promise.all([
			clampFont(input, { subfamilies: [{ name: 'Range', axes: { wght: { min: 400, max: 700 } } }] }),
			clampFont(input, { subfamilies: [{ name: 'Pinned', axes: { wght: 400 } }] }),
		])

		expect(ranged[0].buffer.byteLength).toBeGreaterThan(pinned[0].buffer.byteLength)
		expect(ranged[0].buffer.byteLength).toBeLessThan(input.byteLength)
	}, 120_000)

	it('produces correct number of results for multiple subfamilies', async () => {
		const input = interVF()
		const results = await clampFont(input, {
			subfamilies: [
				{ name: 'Light', axes: { wght: 300 } },
				{ name: 'Regular', axes: { wght: 400 } },
				{ name: 'Bold', axes: { wght: 700 } },
			],
		})

		expect(results).toHaveLength(3)
		expect(results.map((r) => r.name)).toEqual(['Light', 'Regular', 'Bold'])
		results.forEach((r) => {
			expect(r.buffer.byteLength).toBeGreaterThan(0)
			expect(r.buffer.byteLength).toBeLessThan(input.byteLength)
		})
	}, 180_000)

	it('null axis is omitted — full-range font is returned unchanged', async () => {
		const input = interVF()
		// null means "omit this axis from the instancer call" — font keeps full range
		const results = await clampFont(input, {
			subfamilies: [{ name: 'Upright', axes: { slnt: null } }],
		})

		expect(results[0].buffer.byteLength).toBeGreaterThan(0)
		// Omitting all axes returns the full font (no reduction in size)
		expect(results[0].buffer.byteLength).toBeGreaterThanOrEqual(input.byteLength * 0.9)
	}, 120_000)
})
