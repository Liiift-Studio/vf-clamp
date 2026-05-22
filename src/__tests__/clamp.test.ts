// src/__tests__/clamp.test.ts — unit tests for clampFont()
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clampFont } from '../core/clamp.js'

// vi.mock is hoisted — use vi.hoisted() so the variable is defined before the factory runs
const { mockInstantiateVariableFont } = vi.hoisted(() => ({
	mockInstantiateVariableFont: vi.fn(),
}))

vi.mock('@web-alchemy/fonttools', () => ({
	instantiateVariableFont: mockInstantiateVariableFont,
}))

const MOCK_INPUT = new Uint8Array([0, 1, 2, 3])
const MOCK_CONDENSED = new Uint8Array([10, 11, 12])
const MOCK_SEMICONDENSED = new Uint8Array([20, 21, 22])

beforeEach(() => {
	mockInstantiateVariableFont.mockReset()
})

describe('clampFont', () => {
	it('returns empty array when no subfamilies provided', async () => {
		const results = await clampFont(MOCK_INPUT, { subfamilies: [] })
		expect(results).toEqual([])
		expect(mockInstantiateVariableFont).not.toHaveBeenCalled()
	})

	it('pins a single axis value', async () => {
		mockInstantiateVariableFont.mockResolvedValueOnce(MOCK_CONDENSED)

		const results = await clampFont(MOCK_INPUT, {
			subfamilies: [{ name: 'Condensed', axes: { wdth: 75 } }],
		})

		expect(mockInstantiateVariableFont).toHaveBeenCalledWith(MOCK_INPUT, { wdth: 75 })
		expect(results).toHaveLength(1)
		expect(results[0].name).toBe('Condensed')
		expect(results[0].buffer).toBe(MOCK_CONDENSED)
	})

	it('restricts an axis to a range', async () => {
		mockInstantiateVariableFont.mockResolvedValueOnce(MOCK_CONDENSED)

		await clampFont(MOCK_INPUT, {
			subfamilies: [{ name: 'SemiCondensed', axes: { wdth: { min: 87.5, max: 100 } } }],
		})

		expect(mockInstantiateVariableFont).toHaveBeenCalledWith(MOCK_INPUT, { wdth: [87.5, 100] })
	})

	it('omits a null axis from the instancer call (keeps full range)', async () => {
		mockInstantiateVariableFont.mockResolvedValueOnce(MOCK_CONDENSED)

		await clampFont(MOCK_INPUT, {
			subfamilies: [{ name: 'Narrow', axes: { wdth: null } }],
		})

		// null → axis omitted from the instancer call; JS null cannot safely bridge to Python None
		expect(mockInstantiateVariableFont).toHaveBeenCalledWith(MOCK_INPUT, {})
	})

	it('handles mixed axis configs in one subfamily', async () => {
		mockInstantiateVariableFont.mockResolvedValueOnce(MOCK_CONDENSED)

		await clampFont(MOCK_INPUT, {
			subfamilies: [
				{
					name: 'Condensed',
					axes: {
						wdth: 75,
						wght: { min: 300, max: 700 },
						ital: null,
					},
				},
			],
		})

		// ital: null → omitted from instancer call (null axes are skipped)
		expect(mockInstantiateVariableFont).toHaveBeenCalledWith(MOCK_INPUT, {
			wdth: 75,
			wght: [300, 700],
		})
	})

	it('processes multiple subfamilies sequentially', async () => {
		mockInstantiateVariableFont
			.mockResolvedValueOnce(MOCK_CONDENSED)
			.mockResolvedValueOnce(MOCK_SEMICONDENSED)

		const results = await clampFont(MOCK_INPUT, {
			subfamilies: [
				{ name: 'Condensed', axes: { wdth: 75 } },
				{ name: 'SemiCondensed', axes: { wdth: 87.5 } },
			],
		})

		expect(mockInstantiateVariableFont).toHaveBeenCalledTimes(2)
		expect(results[0].name).toBe('Condensed')
		expect(results[0].buffer).toBe(MOCK_CONDENSED)
		expect(results[1].name).toBe('SemiCondensed')
		expect(results[1].buffer).toBe(MOCK_SEMICONDENSED)
	})

	it('preserves subfamily order in results', async () => {
		const buffers = [new Uint8Array([1]), new Uint8Array([2]), new Uint8Array([3])]
		buffers.forEach((b) => mockInstantiateVariableFont.mockResolvedValueOnce(b))

		const results = await clampFont(MOCK_INPUT, {
			subfamilies: [
				{ name: 'Narrow', axes: { wdth: 62.5 } },
				{ name: 'Condensed', axes: { wdth: 75 } },
				{ name: 'SemiCondensed', axes: { wdth: 87.5 } },
			],
		})

		expect(results.map((r) => r.name)).toEqual(['Narrow', 'Condensed', 'SemiCondensed'])
	})
})
