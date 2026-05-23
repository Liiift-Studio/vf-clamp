'use client'
// Demo.tsx — interactive vf-clamp demo: load a font, configure axis clamps,
// get live validation + code, optionally download the restricted font.

import { useState, useCallback, useRef, useEffect } from 'react'
import type { AxisDefinition, FontInstance } from 'vf-clamp'

// ── Types ────────────────────────────────────────────────────────────────────

type AxisMode = 'full' | 'pin' | 'range'

interface AxisConfig {
	mode: AxisMode
	pin: number
	rangeMin: number
	rangeMax: number
}

interface SubfamilyState {
	id: string
	name: string
	axisConfigs: Record<string, AxisConfig>
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function defaultConfig(axis: AxisDefinition): AxisConfig {
	return { mode: 'full', pin: axis.default, rangeMin: axis.minimum, rangeMax: axis.maximum }
}

function newSubfamily(axes: AxisDefinition[], name = 'Variant'): SubfamilyState {
	const axisConfigs: Record<string, AxisConfig> = {}
	for (const a of axes) axisConfigs[a.tag] = defaultConfig(a)
	return { id: crypto.randomUUID(), name, axisConfigs }
}

function subfamilyFromInstance(inst: FontInstance, axes: AxisDefinition[]): SubfamilyState {
	const axisConfigs: Record<string, AxisConfig> = {}
	for (const a of axes) {
		const coord = inst.coordinates[a.tag]
		axisConfigs[a.tag] = {
			mode: coord !== undefined ? 'pin' : 'full',
			pin: coord ?? a.default,
			rangeMin: a.minimum,
			rangeMax: a.maximum,
		}
	}
	return { id: crypto.randomUUID(), name: inst.name, axisConfigs }
}

// Encode Uint8Array → base64 without exceeding call-stack limits on large fonts
function toBase64(buf: Uint8Array<ArrayBuffer>): string {
	let binary = ''
	const chunk = 0x8000
	for (let i = 0; i < buf.length; i += chunk) {
		binary += String.fromCharCode(...buf.subarray(i, i + chunk))
	}
	return btoa(binary)
}

// ── Validation ───────────────────────────────────────────────────────────────

interface AxisIssue {
	type: 'error' | 'warning'
	message: string
}

function validateAxis(cfg: AxisConfig, axis: AxisDefinition): AxisIssue | null {
	if (cfg.mode === 'pin') {
		if (cfg.pin < axis.minimum || cfg.pin > axis.maximum) {
			return { type: 'error', message: `${cfg.pin} is outside the axis range [${axis.minimum}–${axis.maximum}]` }
		}
	}
	if (cfg.mode === 'range') {
		if (cfg.rangeMin >= cfg.rangeMax) {
			return { type: 'error', message: 'Min must be less than max' }
		}
		if (cfg.rangeMin < axis.minimum || cfg.rangeMax > axis.maximum) {
			return { type: 'warning', message: `Range exceeds axis bounds — fonttools will clip to [${axis.minimum}–${axis.maximum}]` }
		}
	}
	return null
}

function demoHasErrors(subfamilies: SubfamilyState[], axes: AxisDefinition[]): boolean {
	for (const sub of subfamilies) {
		for (const axis of axes) {
			const cfg = sub.axisConfigs[axis.tag]
			if (cfg && validateAxis(cfg, axis)?.type === 'error') return true
		}
	}
	return false
}

// ── Code generation ──────────────────────────────────────────────────────────

function generateCode(subfamilies: SubfamilyState[], axes: AxisDefinition[]): string {
	if (!subfamilies.length) {
		return `import { clampFont } from 'vf-clamp'\n\n// Add a variant below to generate code`
	}

	const subLines = subfamilies.flatMap((sub) => {
		const entries: string[] = []
		for (const axis of axes) {
			const cfg = sub.axisConfigs[axis.tag]
			if (!cfg || cfg.mode === 'full') continue
			if (cfg.mode === 'pin') {
				entries.push(`        ${axis.tag}: ${cfg.pin},`)
			} else {
				entries.push(`        ${axis.tag}: { min: ${cfg.rangeMin}, max: ${cfg.rangeMax} },`)
			}
		}
		if (!entries.length) {
			return [`    { name: '${sub.name}', axes: {} },`]
		}
		return [
			`    {`,
			`      name: '${sub.name}',`,
			`      axes: {`,
			...entries,
			`      },`,
			`    },`,
		]
	})

	return [
		`import { clampFont } from 'vf-clamp'`,
		`import { readFile, writeFile } from 'fs/promises'`,
		``,
		`const source = await readFile('MyFont-VF.ttf')`,
		``,
		`const results = await clampFont(source, {`,
		`  subfamilies: [`,
		...subLines,
		`  ],`,
		`})`,
		``,
		`for (const result of results) {`,
		`  await writeFile(\`MyFont-\${result.name}-VF.ttf\`, result.buffer)`,
		`}`,
	].join('\n')
}

// ── Sub-components ───────────────────────────────────────────────────────────

function ModeToggle({ mode, onChange }: { mode: AxisMode; onChange: (m: AxisMode) => void }) {
	return (
		<div className="flex rounded-md overflow-hidden border border-white/10 text-xs shrink-0">
			{(['full', 'pin', 'range'] as AxisMode[]).map((m) => (
				<button
					key={m}
					onClick={() => onChange(m)}
					className={`px-2.5 py-1 capitalize transition-colors ${
						mode === m ? 'bg-white/15 text-white' : 'text-white/35 hover:text-white/60'
					}`}
				>
					{m}
				</button>
			))}
		</div>
	)
}

function AxisRow({
	axis,
	config,
	onChange,
}: {
	axis: AxisDefinition
	config: AxisConfig
	onChange: (cfg: AxisConfig) => void
}) {
	const issue = validateAxis(config, axis)
	const step = axis.maximum - axis.minimum > 100 ? 1 : axis.maximum - axis.minimum > 10 ? 0.5 : 0.1

	return (
		<div className="flex flex-col gap-2 py-3 border-t border-white/5">
			<div className="flex items-center gap-3 flex-wrap">
				<span className="text-sm flex-1 min-w-0 leading-tight">
					<span className="opacity-80">{axis.name}</span>
					<span className="ml-2 text-xs font-mono opacity-30">{axis.tag}</span>
					<span className="ml-2 text-xs opacity-20 tabular-nums">
						{axis.minimum}–{axis.maximum}
					</span>
				</span>
				<ModeToggle mode={config.mode} onChange={(m) => onChange({ ...config, mode: m })} />
			</div>

			{config.mode === 'pin' && (
				<div className="flex items-center gap-3">
					<input
						type="range"
						min={axis.minimum}
						max={axis.maximum}
						step={step}
						value={config.pin}
						onChange={(e) => onChange({ ...config, pin: Number(e.target.value) })}
						className="flex-1"
						style={{ touchAction: 'none' }}
						aria-label={`${axis.name} pin value`}
					/>
					<input
						type="number"
						min={axis.minimum}
						max={axis.maximum}
						step={step}
						value={config.pin}
						onChange={(e) => onChange({ ...config, pin: Number(e.target.value) })}
						className="w-16 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs font-mono text-right"
						aria-label={`${axis.name} pin value (number)`}
					/>
				</div>
			)}

			{config.mode === 'range' && (
				<div className="flex flex-col gap-2">
					<div className="flex items-center gap-3">
						<span className="text-xs opacity-35 w-7 shrink-0 tabular-nums">min</span>
						<input
							type="range"
							min={axis.minimum}
							max={axis.maximum}
							step={step}
							value={config.rangeMin}
							onChange={(e) => onChange({ ...config, rangeMin: Number(e.target.value) })}
							className="flex-1"
							style={{ touchAction: 'none' }}
							aria-label={`${axis.name} range minimum`}
						/>
						<input
							type="number"
							min={axis.minimum}
							max={axis.maximum}
							step={step}
							value={config.rangeMin}
							onChange={(e) => onChange({ ...config, rangeMin: Number(e.target.value) })}
							className="w-16 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs font-mono text-right"
							aria-label={`${axis.name} range minimum (number)`}
						/>
					</div>
					<div className="flex items-center gap-3">
						<span className="text-xs opacity-35 w-7 shrink-0 tabular-nums">max</span>
						<input
							type="range"
							min={axis.minimum}
							max={axis.maximum}
							step={step}
							value={config.rangeMax}
							onChange={(e) => onChange({ ...config, rangeMax: Number(e.target.value) })}
							className="flex-1"
							style={{ touchAction: 'none' }}
							aria-label={`${axis.name} range maximum`}
						/>
						<input
							type="number"
							min={axis.minimum}
							max={axis.maximum}
							step={step}
							value={config.rangeMax}
							onChange={(e) => onChange({ ...config, rangeMax: Number(e.target.value) })}
							className="w-16 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs font-mono text-right"
							aria-label={`${axis.name} range maximum (number)`}
						/>
					</div>
				</div>
			)}

			{issue && (
				<p className={`text-xs ${issue.type === 'error' ? 'text-red-400' : 'text-amber-400/80'}`}>
					{issue.type === 'error' ? '✕' : '⚠'} {issue.message}
				</p>
			)}
		</div>
	)
}

// ── Main component ────────────────────────────────────────────────────────────

const DEFAULT_FONT_URL = '/fonts/Inter-Variable.ttf'
const DEFAULT_FONT_NAME = 'Inter Variable'
const ACCEPT = '.ttf,.otf,.woff,.woff2'

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

export default function Demo() {
	const [fontBuffer, setFontBuffer] = useState<Uint8Array<ArrayBuffer> | null>(null)
	const [fontName, setFontName]     = useState('')
	const [axes, setAxes]             = useState<AxisDefinition[]>([])
	const [instances, setInstances]   = useState<FontInstance[]>([])
	const [loadState, setLoadState]   = useState<LoadState>('idle')
	const [loadError, setLoadError]   = useState<string | null>(null)

	const [subfamilies, setSubfamilies] = useState<SubfamilyState[]>([])

	const [processing, setProcessing]   = useState(false)
	const [processError, setProcessError] = useState<string | null>(null)

	const isLoadingRef  = useRef(false)
	const containerRef  = useRef<HTMLDivElement>(null)
	const warmedUpRef   = useRef(false)

	// Fire a lightweight warmup ping when the demo section scrolls into view.
	// Covers the cost of one invocation only for users who actually see the demo.
	useEffect(() => {
		const el = containerRef.current
		if (!el) return
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && !warmedUpRef.current) {
					warmedUpRef.current = true
					observer.disconnect()
					// POST a 1-byte body — enough to trigger preparePyodide() on the server
					// without doing any real work. Fire-and-forget; errors are benign.
					fetch('/api/demo/instances', {
						method: 'POST',
						headers: { 'Content-Type': 'application/octet-stream' },
						body: new Uint8Array([0]),
					}).catch(() => { /* warmup failure is non-fatal */ })
				}
			},
			{ threshold: 0.1 }
		)
		observer.observe(el)
		return () => observer.disconnect()
	}, [])

	const loadFont = useCallback(async (buffer: Uint8Array<ArrayBuffer>, name: string) => {
		if (isLoadingRef.current) return
		isLoadingRef.current = true

		setLoadState('loading')
		setLoadError(null)
		setAxes([])
		setInstances([])
		setSubfamilies([])
		setFontBuffer(buffer)
		setFontName(name)

		try {
			const res = await fetch('/api/demo/instances', {
				method: 'POST',
				headers: { 'Content-Type': 'application/octet-stream' },
				body: buffer,
			})
			const json = await res.json()
			if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
			if (!json.axes?.length) throw new Error('No variable axes found — this may not be a variable font')
			setAxes(json.axes)
			setInstances(json.instances ?? [])
			setLoadState('ready')
		} catch (err) {
			setLoadError(err instanceof Error ? err.message : 'Failed to read font')
			setLoadState('error')
		} finally {
			isLoadingRef.current = false
		}
	}, [])

	const handleLoadDefault = useCallback(async () => {
		if (loadState !== 'idle' && loadState !== 'error') return
		setLoadState('loading')
		try {
			const res = await fetch(DEFAULT_FONT_URL)
			if (!res.ok) throw new Error(`HTTP ${res.status}`)
			const buffer = new Uint8Array(await res.arrayBuffer())
			await loadFont(buffer, DEFAULT_FONT_NAME)
		} catch (err) {
			setLoadError(err instanceof Error ? err.message : 'Failed to load Inter Variable')
			setLoadState('error')
		}
	}, [loadState, loadFont])

	const handleFile = useCallback(async (file: File) => {
		const buffer = new Uint8Array(await file.arrayBuffer())
		await loadFont(buffer, file.name.replace(/\.(ttf|otf|woff2?)$/i, ''))
	}, [loadFont])

	function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0]
		if (file) handleFile(file)
		e.target.value = ''
	}

	function handleDrop(e: React.DragEvent) {
		e.preventDefault()
		const file = e.dataTransfer.files[0]
		if (file) handleFile(file)
	}

	function addSubfamily() {
		setSubfamilies((prev) => [...prev, newSubfamily(axes, `Variant ${prev.length + 1}`)])
	}

	function removeSubfamily(id: string) {
		setSubfamilies((prev) => prev.filter((s) => s.id !== id))
	}

	function renameSubfamily(id: string, name: string) {
		setSubfamilies((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)))
	}

	function updateAxisConfig(subfamilyId: string, tag: string, cfg: AxisConfig) {
		setSubfamilies((prev) =>
			prev.map((s) =>
				s.id === subfamilyId ? { ...s, axisConfigs: { ...s.axisConfigs, [tag]: cfg } } : s
			)
		)
	}

	async function handleDownload() {
		if (!fontBuffer || !subfamilies.length) return
		setProcessing(true)
		setProcessError(null)

		try {
			const configs = subfamilies.map((sub) => {
				const axes_out: Record<string, number | { min: number; max: number }> = {}
				for (const axis of axes) {
					const cfg = sub.axisConfigs[axis.tag]
					if (!cfg || cfg.mode === 'full') continue
					if (cfg.mode === 'pin') axes_out[axis.tag] = cfg.pin
					else axes_out[axis.tag] = { min: cfg.rangeMin, max: cfg.rangeMax }
				}
				return { name: sub.name, axes: axes_out }
			})

			const res = await fetch('/api/demo/clamp', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ font: toBase64(fontBuffer), subfamilies: configs }),
			})
			const json = await res.json()
			if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)

			for (const result of json.results) {
				const bytes = Uint8Array.from(atob(result.data), (c) => c.charCodeAt(0))
				const blob = new Blob([bytes], { type: 'font/ttf' })
				const url = URL.createObjectURL(blob)
				const a = document.createElement('a')
				a.href = url
				a.download = `${result.name}-VF.ttf`
				a.click()
				URL.revokeObjectURL(url)
			}
		} catch (err) {
			setProcessError(err instanceof Error ? err.message : 'Processing failed')
		} finally {
			setProcessing(false)
		}
	}

	const code   = generateCode(subfamilies, axes)
	const errors = demoHasErrors(subfamilies, axes)

	const noRestrictions =
		subfamilies.length > 0 &&
		subfamilies.every((sub) =>
			axes.every((a) => (sub.axisConfigs[a.tag]?.mode ?? 'full') === 'full')
		)

	return (
		<div ref={containerRef} className="w-full flex flex-col gap-8">

			{/* Upload zone */}
			<div
				onDrop={handleDrop}
				onDragOver={(e) => e.preventDefault()}
				className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-xl border border-dashed border-white/15 py-5 px-5 transition-colors hover:border-white/25"
			>
				<div className="flex-1 min-w-0">
					{(loadState === 'idle' || loadState === 'error') && (
						<div className="flex flex-col gap-1.5">
							<p className="text-sm opacity-60">
								Load{' '}
								<button
									onClick={handleLoadDefault}
									className="underline underline-offset-2 hover:opacity-100 transition-opacity"
								>
									Inter Variable
								</button>{' '}
								or drop any variable font to explore its axes
							</p>
							{loadState === 'error' && loadError && (
								<p className="text-xs text-red-400">{loadError}</p>
							)}
						</div>
					)}
					{loadState === 'loading' && (
						<div className="flex flex-col gap-1">
							<p className="text-sm opacity-70 animate-pulse">Reading font axes…</p>
							<p className="text-xs opacity-40">
								First load may take 10–20 s while the font engine warms up
							</p>
						</div>
					)}
					{loadState === 'ready' && (
						<div className="flex flex-col gap-0.5">
							<p className="text-sm opacity-80 font-mono">{fontName}</p>
							<p className="text-xs opacity-30 font-mono tabular-nums">
								{axes.map((a) => `${a.tag} ${a.minimum}–${a.maximum}`).join(' · ')}
							</p>
						</div>
					)}
				</div>
				<label className="text-xs px-3 py-1.5 rounded-full border border-white/20 cursor-pointer hover:bg-white/5 transition-colors shrink-0">
					{loadState === 'ready' ? 'Swap font' : 'Browse TTF / WOFF2'}
					<input
						type="file"
						accept={ACCEPT}
						onChange={handleInputChange}
						className="sr-only"
						aria-label="Upload a variable font"
					/>
				</label>
			</div>

			{/* Named instances — quick-add chips */}
			{loadState === 'ready' && instances.length > 0 && (
				<div className="flex flex-col gap-2">
					<p className="text-xs opacity-35 uppercase tracking-widest">
						Named instances — click to add as a variant
					</p>
					<div className="flex flex-wrap gap-1.5">
						{instances.map((inst) => (
							<button
								key={inst.name}
								onClick={() =>
									setSubfamilies((prev) => [...prev, subfamilyFromInstance(inst, axes)])
								}
								className="text-xs px-3 py-1 rounded-full border border-white/10 hover:border-white/25 hover:bg-white/5 transition-colors opacity-50 hover:opacity-100"
							>
								<span className="font-mono">{inst.name}</span>
								<span className="ml-2 opacity-40 font-mono">
									{Object.entries(inst.coordinates)
										.map(([k, v]) => `${k} ${v}`)
										.join(' ')}
								</span>
							</button>
						))}
					</div>
				</div>
			)}

			{/* Variant cards */}
			{loadState === 'ready' && (
				<div className="flex flex-col gap-4">
					{subfamilies.length === 0 && (
						<p className="text-sm opacity-30 italic">
							Add a variant to start configuring axis restrictions
						</p>
					)}

					{subfamilies.map((sub) => (
						<div key={sub.id} className="rounded-xl border border-white/10 px-5 pt-4 pb-5">
							<div className="flex items-center gap-3 mb-2">
								<input
									type="text"
									value={sub.name}
									onChange={(e) => renameSubfamily(sub.id, e.target.value)}
									placeholder="Variant name"
									className="flex-1 bg-transparent text-sm font-mono border-b border-white/10 focus:border-white/30 outline-none pb-1"
									aria-label="Variant name"
								/>
								<button
									onClick={() => removeSubfamily(sub.id)}
									className="text-xs opacity-25 hover:opacity-60 transition-opacity shrink-0"
								>
									Remove
								</button>
							</div>

							{axes.map((axis) => (
								<AxisRow
									key={axis.tag}
									axis={axis}
									config={sub.axisConfigs[axis.tag] ?? defaultConfig(axis)}
									onChange={(cfg) => updateAxisConfig(sub.id, axis.tag, cfg)}
								/>
							))}
						</div>
					))}

					<button
						onClick={addSubfamily}
						className="self-start text-xs px-4 py-2 rounded-full border border-white/15 hover:bg-white/5 transition-colors opacity-50 hover:opacity-100"
					>
						+ Add variant
					</button>
				</div>
			)}

			{/* Validation callouts */}
			{noRestrictions && (
				<p className="text-xs text-amber-400/70">
					⚠ All axes are set to Full — no axis restrictions means the output will be the same size as the input
				</p>
			)}

			{/* Code output */}
			{loadState === 'ready' && (
				<div className="flex flex-col gap-2">
					<p className="text-xs opacity-35 uppercase tracking-widest">Generated code</p>
					<pre className="bg-white/5 rounded-xl p-4 overflow-x-auto text-xs leading-relaxed font-mono opacity-75 whitespace-pre">
						<code>{code}</code>
					</pre>
				</div>
			)}

			{/* Download */}
			{loadState === 'ready' && subfamilies.length > 0 && (
				<div className="flex flex-col gap-2">
					{errors && (
						<p className="text-xs text-red-400">Fix errors above before downloading</p>
					)}
					{processError && (
						<p className="text-xs text-red-400">{processError}</p>
					)}
					<div className="flex items-center gap-4 flex-wrap">
						<button
							onClick={handleDownload}
							disabled={processing || errors}
							className="text-sm px-5 py-2.5 rounded-full border border-white/20 hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
						>
							{processing
								? 'Processing… (may take up to 30 s)'
								: `Download ${subfamilies.length === 1 ? '1 variant' : `${subfamilies.length} variants`} as TTF`}
						</button>
						{processing && (
							<p className="text-xs opacity-35">
								fonttools is running on the server — first run includes engine startup
							</p>
						)}
					</div>
				</div>
			)}
		</div>
	)
}
