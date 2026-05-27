// src/__tests__/clamp.test.ts — unit tests for clampFont()
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clampFont } from '../core/clamp.js'
import { convertToWoff2, convertToWoff } from '../core/convert.js'

// ── Pyodide mock ──────────────────────────────────────────────────────────────
// clamp.ts initialises three Python functions once (cached at module level):
//   1st runPythonAsync call → instancer  (vf_clamp_instantiate)
//   2nd runPythonAsync call → patcher    (patch_font_names_fn)
//   3rd runPythonAsync call → normalizer (vf_clamp_normalize_wght, only if triggered)
// The mocks copy bytes from input-file to output-file so the pipeline runs end-to-end.

const { MockPyodideFile, mockInstancerFn, mockPatcherFn, mockNormalizerFn, mockRunPythonAsync, capturedCalls, resetState } =
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

		const mockPatcherFn   = vi.fn((opts: Map<string, string>) => {
			const s = fileStore.get(opts.get('input-file')!)
			const d = fileStore.get(opts.get('output-file')!)
			if (s && d) d.bytes = new Uint8Array(s.bytes)
		})

		const mockInstancerFn = vi.fn((opts: Map<string, string>, axesJson: string) => {
			capturedCalls.push({ axesJson })
			const s = fileStore.get(opts.get('input-file')!)
			const d = fileStore.get(opts.get('output-file')!)
			if (s && d) d.bytes = new Uint8Array(s.bytes)
		})

		const mockNormalizerFn = vi.fn((opts: Map<string, string>) => {
			const s = fileStore.get(opts.get('input-file')!)
			const d = fileStore.get(opts.get('output-file')!)
			if (s && d) d.bytes = new Uint8Array(s.bytes)
		})

		function resetState() {
			fileStore.clear()
			fileCounter = 0
			capturedCalls.length = 0
			mockPatcherFn.mockClear()
			mockInstancerFn.mockClear()
			mockNormalizerFn.mockClear()
		}

		// runPythonAsync returns mock functions in initialization order (cached after first call).
		const mockRunPythonAsync = vi.fn()
			.mockResolvedValueOnce(mockInstancerFn)   // 1st init: instancer
			.mockResolvedValueOnce(mockPatcherFn)     // 2nd init: patcher
			.mockResolvedValueOnce(mockNormalizerFn)  // 3rd init: normalizer (normalizeWeightAxis tests)

		return { MockPyodideFile, mockInstancerFn, mockPatcherFn, mockNormalizerFn, mockRunPythonAsync, capturedCalls, resetState }
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
})
