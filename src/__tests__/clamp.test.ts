// src/__tests__/clamp.test.ts — unit tests for clampFont()
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clampFont } from '../core/clamp.js'
import { convertToWoff2, convertToWoff } from '../core/convert.js'
import { getInstances } from '../core/instances.js'

// ── Pyodide mock ──────────────────────────────────────────────────────────────
// clamp.ts uses Promise-singleton caches for three Python functions. On first invocation
// of each pipeline stage the corresponding Promise is created and runPythonAsync called:
//   1st runPythonAsync call → instancer  (vf_clamp_instantiate)
//   2nd runPythonAsync call → patcher    (patch_font_names_fn)
//   3rd runPythonAsync call → normalizer (vf_clamp_normalize_wght, only if triggered)
// Subsequent calls reuse the cached Promise. Mocks copy bytes input→output.
// NOTE: The test module is NOT isolated between tests (vi.isolateModules not used),
// so the Promise caches remain warm after the first test that populates them.

const { MockPyodideFile, mockInstancerFn, mockPatcherFn, mockNormalizerFn, mockStatPrunerFn, mockOs2UpdaterFn, mockRunPythonAsync, capturedCalls, resetState } =
	vi.hoisted(() => {
		const fileStore = new Map<string, { bytes: Uint8Array }>()
		let fileCounter = 0
		const capturedCalls: Array<{ axesJson: string }> = []

		class MockPyodideFile {
			filename: string
			private store: { bytes: Uint8Array }

			constructor() {
				this.filename = `f${fileCounter++}.ttf`
				this.store    = { bytes: new Uint8Array() }
				fileStore.set(this.filename, this.store)
			}

			async upload(buf: Uint8Array) { this.store.bytes = new Uint8Array(buf) }
			download() { return this.store.bytes }
			delete() { fileStore.delete(this.filename) }
		}

		// Copy bytes from input to output file slot — common to all stages.
		function copyInputToOutput(opts: Map<string, string>) {
			const s = fileStore.get(opts.get('input-file')!)
			const d = fileStore.get(opts.get('output-file')!)
			if (s && d) d.bytes = new Uint8Array(s.bytes)
		}

		const mockPatcherFn    = vi.fn((opts: Map<string, string>) => copyInputToOutput(opts))
		const mockStatPrunerFn = vi.fn((opts: Map<string, string>) => copyInputToOutput(opts))
		const mockOs2UpdaterFn = vi.fn((opts: Map<string, string>) => copyInputToOutput(opts))
		const mockNormalizerFn = vi.fn((opts: Map<string, string>) => copyInputToOutput(opts))

		const mockInstancerFn = vi.fn((opts: Map<string, string>, axesJson: string) => {
			capturedCalls.push({ axesJson })
			copyInputToOutput(opts)
		})

		function resetState() {
			fileStore.clear()
			fileCounter = 0
			capturedCalls.length = 0
			mockPatcherFn.mockClear()
			mockInstancerFn.mockClear()
			mockNormalizerFn.mockClear()
			mockStatPrunerFn.mockClear()
			mockOs2UpdaterFn.mockClear()
		}

		// Dispatch runPythonAsync by inspecting the Python source. The Promise-singleton
		// caches in clamp.ts mean each helper is initialised at most once per process, so
		// this is order-independent and survives the test file's lack of module isolation.
		const mockRunPythonAsync = vi.fn(async (source: string) => {
			if (source.includes('vf_clamp_instantiate')) return mockInstancerFn
			if (source.includes('patch_font_names_fn')) return mockPatcherFn
			if (source.includes('vf_clamp_normalize_wght')) return mockNormalizerFn
			if (source.includes('vf_clamp_prune_stat')) return mockStatPrunerFn
			if (source.includes('vf_clamp_update_os2')) return mockOs2UpdaterFn
			throw new Error('Unrecognised Python source in test mock: ' + source.slice(0, 80))
		})

		return { MockPyodideFile, mockInstancerFn, mockPatcherFn, mockNormalizerFn, mockStatPrunerFn, mockOs2UpdaterFn, mockRunPythonAsync, capturedCalls, resetState }
	})

vi.mock('../core/pyodide.js', () => ({
	preparePyodide: vi.fn().mockResolvedValue({ runPythonAsync: mockRunPythonAsync }),
	PyodideFile: MockPyodideFile,
}))

vi.mock('../core/convert.js', () => ({
	convertToWoff2: vi.fn(),
	convertToWoff:  vi.fn(),
}))

vi.mock('../core/instances.js', () => ({
	getInstances: vi.fn(),
}))

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_INPUT = new Uint8Array([0, 1, 2, 3])

beforeEach(() => {
	resetState()
	vi.mocked(convertToWoff2).mockReset()
	vi.mocked(convertToWoff).mockReset()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('clampFont', () => {
	it('returns empty array when no outputs provided', async () => {
		const results = await clampFont(MOCK_INPUT, { outputs: [] })
		expect(results).toEqual([])
		expect(mockInstancerFn).not.toHaveBeenCalled()
	})

	it('pins a single axis value', async () => {
		const results = await clampFont(MOCK_INPUT, {
			outputs: [{ name: 'Condensed', axes: { wdth: 75 } }],
		})

		expect(capturedCalls).toHaveLength(1)
		expect(JSON.parse(capturedCalls[0].axesJson)).toEqual({ wdth: 75 })
		expect(results).toHaveLength(1)
		expect(results[0].name).toBe('Condensed')
		expect(results[0].buffer).toBeInstanceOf(Uint8Array)
	})

	it('restricts an axis to a range', async () => {
		await clampFont(MOCK_INPUT, {
			outputs: [{ name: 'SemiCondensed', axes: { wdth: { min: 87.5, max: 100 } } }],
		})

		expect(capturedCalls).toHaveLength(1)
		expect(JSON.parse(capturedCalls[0].axesJson)).toEqual({ wdth: [87.5, 100] })
	})

	it('omits a null axis from the instancer call (keeps full range)', async () => {
		await clampFont(MOCK_INPUT, {
			outputs: [{ name: 'Narrow', axes: { wdth: null } }],
		})

		expect(capturedCalls).toHaveLength(1)
		expect(JSON.parse(capturedCalls[0].axesJson)).toEqual({})
	})

	it('handles mixed axis configs in one output', async () => {
		await clampFont(MOCK_INPUT, {
			outputs: [
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

		expect(capturedCalls).toHaveLength(1)
		expect(JSON.parse(capturedCalls[0].axesJson)).toEqual({ wdth: 75, wght: [300, 700] })
	})

	it('processes multiple outputs sequentially', async () => {
		const results = await clampFont(MOCK_INPUT, {
			outputs: [
				{ name: 'Condensed',     axes: { wdth: 75 } },
				{ name: 'SemiCondensed', axes: { wdth: 87.5 } },
			],
		})

		expect(capturedCalls).toHaveLength(2)
		expect(results[0].name).toBe('Condensed')
		expect(results[1].name).toBe('SemiCondensed')
	})

	it('defaults to ttf format', async () => {
		const results = await clampFont(MOCK_INPUT, {
			outputs: [{ name: 'Condensed', axes: { wdth: 75 } }],
		})

		expect(results[0].format).toBe('ttf')
		expect(vi.mocked(convertToWoff2)).not.toHaveBeenCalled()
	})

	it('converts output to woff2 when format is specified', async () => {
		const MOCK_WOFF2 = new Uint8Array([0x77, 0x4f, 0x46, 0x32])
		vi.mocked(convertToWoff2).mockResolvedValueOnce(MOCK_WOFF2)

		const results = await clampFont(MOCK_INPUT, {
			format: 'woff2',
			outputs: [{ name: 'Condensed', axes: { wdth: 75 } }],
		})

		expect(vi.mocked(convertToWoff2)).toHaveBeenCalledTimes(1)
		expect(results[0].buffer).toBe(MOCK_WOFF2)
		expect(results[0].format).toBe('woff2')
	})

	it('preserves output order in results', async () => {
		const results = await clampFont(MOCK_INPUT, {
			outputs: [
				{ name: 'Narrow',       axes: { wdth: 62.5 } },
				{ name: 'Condensed',    axes: { wdth: 75 } },
				{ name: 'SemiCondens',  axes: { wdth: 87.5 } },
			],
		})

		expect(results.map((r) => r.name)).toEqual(['Narrow', 'Condensed', 'SemiCondens'])
	})

	it('calls normalizer when normalizeWeightAxis is true', async () => {
		await clampFont(MOCK_INPUT, {
			outputs: [{ name: 'Light-Bold', axes: { wght: { min: 300, max: 700 } } }],
			normalizeWeightAxis: true,
		})

		expect(mockNormalizerFn).toHaveBeenCalledTimes(1)
	})

	it('does not call normalizer when normalizeWeightAxis is false', async () => {
		await clampFont(MOCK_INPUT, {
			outputs: [{ name: 'Light-Bold', axes: { wght: { min: 300, max: 700 } } }],
			normalizeWeightAxis: false,
		})

		expect(mockNormalizerFn).not.toHaveBeenCalled()
	})

	it('passes newMin argument of "100" to normalizer', async () => {
		await clampFont(MOCK_INPUT, {
			outputs: [{ name: 'Light-Bold', axes: { wght: { min: 300, max: 700 } } }],
			normalizeWeightAxis: true,
		})

		// Second argument to normalizerFn should be the string '100'
		expect(mockNormalizerFn).toHaveBeenCalledTimes(1)
		const call = mockNormalizerFn.mock.calls[0]
		expect(call[1]).toBe('100')
	})

	it('converts output to woff when format is woff', async () => {
		const MOCK_WOFF = new Uint8Array([0x77, 0x4f, 0x46, 0x46])
		vi.mocked(convertToWoff).mockResolvedValueOnce(MOCK_WOFF)

		const results = await clampFont(MOCK_INPUT, {
			format: 'woff',
			outputs: [{ name: 'Condensed', axes: { wdth: 75 } }],
		})

		expect(vi.mocked(convertToWoff)).toHaveBeenCalledTimes(1)
		expect(vi.mocked(convertToWoff2)).not.toHaveBeenCalled()
		expect(results[0].buffer).toBe(MOCK_WOFF)
		expect(results[0].format).toBe('woff')
	})

	it('does not call any converter when format is otf', async () => {
		const results = await clampFont(MOCK_INPUT, {
			format: 'otf',
			outputs: [{ name: 'Condensed', axes: { wdth: 75 } }],
		})

		expect(vi.mocked(convertToWoff2)).not.toHaveBeenCalled()
		expect(vi.mocked(convertToWoff)).not.toHaveBeenCalled()
		expect(results[0].format).toBe('otf')
	})

	describe('instances path', () => {
		const MOCK_INSTANCES = {
			axes: [{ tag: 'wght', name: 'Weight', minimum: 100, default: 400, maximum: 900 }],
			instances: [
				{ name: 'Light', coordinates: { wght: 300 } },
				{ name: 'Regular', coordinates: { wght: 400 } },
				{ name: 'Bold', coordinates: { wght: 700 } },
			],
		}

		beforeEach(() => {
			vi.mocked(getInstances).mockReset()
			vi.mocked(getInstances).mockResolvedValue(MOCK_INSTANCES)
		})

		it('computes axis hull from named instances and passes to instancer', async () => {
			const results = await clampFont(MOCK_INPUT, {
				outputs: [{ name: 'Light-Bold', instances: ['Light', 'Bold'] }],
			})

			expect(capturedCalls).toHaveLength(1)
			expect(JSON.parse(capturedCalls[0].axesJson)).toEqual({ wght: [300, 700] })
			expect(results[0].name).toBe('Light-Bold')
		})

		it('pins axis when all instances share the same coordinate', async () => {
			await clampFont(MOCK_INPUT, {
				outputs: [{ name: 'Regular', instances: ['Regular'] }],
			})

			expect(JSON.parse(capturedCalls[0].axesJson)).toEqual({ wght: 400 })
		})

		it('auto-derives name from first and last instance when name is omitted', async () => {
			const results = await clampFont(MOCK_INPUT, {
				outputs: [{ instances: ['Light', 'Bold'] }],
			})

			expect(results[0].name).toBe('Light-Bold')
		})

		it('auto-derives name as single instance name when only one instance', async () => {
			const results = await clampFont(MOCK_INPUT, {
				outputs: [{ instances: ['Regular'] }],
			})

			expect(results[0].name).toBe('Regular')
		})

		it('explicit axes override instance hull per tag', async () => {
			await clampFont(MOCK_INPUT, {
				outputs: [{
					name: 'Custom',
					instances: ['Light', 'Bold'],
					axes: { wght: { min: 200, max: 800 } },
				}],
			})

			// Explicit axes override the hull values
			expect(JSON.parse(capturedCalls[0].axesJson)).toEqual({ wght: [200, 800] })
		})

		it('throws when a named instance is not found in the font', async () => {
			await expect(
				clampFont(MOCK_INPUT, {
					outputs: [{ name: 'Missing', instances: ['NonExistent'] }],
				})
			).rejects.toThrow('Named instance "NonExistent" not found in font')
		})

		it('calls getInstances once even for multiple outputs using instances', async () => {
			await clampFont(MOCK_INPUT, {
				outputs: [
					{ name: 'A', instances: ['Light', 'Regular'] },
					{ name: 'B', instances: ['Regular', 'Bold'] },
				],
			})

			expect(vi.mocked(getInstances)).toHaveBeenCalledTimes(1)
		})
	})
})
