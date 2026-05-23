'use client'
// Demo.tsx — instance-based vf-clamp demo: select named instances, preview restricted VF groups, download.

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import type { AxisDefinition, FontInstance } from 'vf-clamp'

// ── Types ─────────────────────────────────────────────────────────────────────

/** A group of adjacent selected instances that produces one VF output file. */
interface InstanceGroup {
	instances: FontInstance[]
	axisRanges: Record<string, { min: number; max: number }>
	/** Unselected instances whose coordinates fall inside this group's axis hull. */
	collateral: string[]
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

// ── Helpers ───────────────────────────────────────────────────────────────────

function toBase64(buf: Uint8Array<ArrayBuffer>): string {
	let binary = ''
	const chunk = 0x8000
	for (let i = 0; i < buf.length; i += chunk)
		binary += String.fromCharCode(...buf.subarray(i, i + chunk))
	return btoa(binary)
}

/** The axis with the widest normalised range — used as the primary sort key. */
function primaryAxis(axes: AxisDefinition[]): AxisDefinition | null {
	if (!axes.length) return null
	return axes.reduce((best, a) =>
		a.maximum - a.minimum > best.maximum - best.minimum ? a : best,
	)
}

/**
 * Group selected instances into contiguous runs along the primary axis.
 * Two selected instances belong to the same run only when no unselected
 * instance sits between them in primary-axis sort order.
 */
function computeGroups(
	instances: FontInstance[],
	selected: Set<string>,
	axes: AxisDefinition[],
): InstanceGroup[] {
	if (!selected.size || !axes.length) return []

	const primary = primaryAxis(axes)
	if (!primary) return []

	const sorted = [...instances].sort(
		(a, b) =>
			(a.coordinates[primary.tag] ?? primary.default) -
			(b.coordinates[primary.tag] ?? primary.default),
	)

	// Build runs of consecutive selected instances
	const runs: FontInstance[][] = []
	let current: FontInstance[] = []
	for (const inst of sorted) {
		if (selected.has(inst.name)) {
			current.push(inst)
		} else if (current.length) {
			runs.push(current)
			current = []
		}
	}
	if (current.length) runs.push(current)

	// Per run: compute hull and find collateral (unselected instances inside hull)
	return runs.map((run) => {
		const axisRanges: Record<string, { min: number; max: number }> = {}
		for (const axis of axes) {
			const vals = run.map((i) => i.coordinates[axis.tag] ?? axis.default)
			axisRanges[axis.tag] = { min: Math.min(...vals), max: Math.max(...vals) }
		}

		const collateral = instances
			.filter((inst) => {
				if (selected.has(inst.name)) return false
				return axes.every((axis) => {
					const v = inst.coordinates[axis.tag] ?? axis.default
					const r = axisRanges[axis.tag]
					return v >= r.min && v <= r.max
				})
			})
			.map((i) => i.name)

		return { instances: run, axisRanges, collateral }
	})
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Horizontal bar showing where a restricted range sits on the full axis span. */
function AxisRangeBar({
	axis,
	range,
}: {
	axis: AxisDefinition
	range: { min: number; max: number }
}) {
	const full = axis.maximum - axis.minimum || 1
	const leftPct  = ((range.min - axis.minimum) / full) * 100
	const widthPct = ((range.max - range.min) / full) * 100

	return (
		<div className="flex items-center gap-3 text-xs">
			<span className="font-mono opacity-40 w-10 shrink-0">{axis.tag}</span>
			<div className="flex-1 h-1.5 bg-white/10 rounded-full relative">
				<div
					className="absolute h-full bg-white/60 rounded-full"
					style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 0.5)}%` }}
				/>
			</div>
			<span className="font-mono opacity-40 tabular-nums w-24 text-right shrink-0">
				{range.min === range.max ? range.min : `${range.min}–${range.max}`}
			</span>
		</div>
	)
}

/** Text specimen that animates through the axis range using CSS font-variation-settings. */
function TextPreview({
	axes,
	axisRanges,
}: {
	axes: AxisDefinition[]
	axisRanges: Record<string, { min: number; max: number }>
}) {
	const [progress, setProgress] = useState(0)
	const rafRef   = useRef<number>(0)
	const startRef = useRef<number | null>(null)
	const DURATION = 2800

	useEffect(() => {
		startRef.current = null
		function tick(now: number) {
			if (!startRef.current) startRef.current = now
			const t = ((now - startRef.current) % (DURATION * 2)) / DURATION
			setProgress(t <= 1 ? t : 2 - t) // ping-pong 0 → 1 → 0
			rafRef.current = requestAnimationFrame(tick)
		}
		rafRef.current = requestAnimationFrame(tick)
		return () => cancelAnimationFrame(rafRef.current)
	}, [axisRanges])

	const variationSettings = useMemo(() => {
		return axes
			.map((axis) => {
				const r = axisRanges[axis.tag]
				if (!r) return null
				const eased = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress
				const v = r.min + (r.max - r.min) * eased
				return `'${axis.tag}' ${v.toFixed(1)}`
			})
			.filter(Boolean)
			.join(', ')
	}, [axes, axisRanges, progress])

	return (
		<p
			style={{ fontFamily: '"vf-demo", sans-serif', fontVariationSettings: variationSettings }}
			className="text-4xl leading-tight opacity-90 select-none overflow-hidden"
			aria-hidden="true"
		>
			Aa Bb 012
		</p>
	)
}

// ── Main component ────────────────────────────────────────────────────────────

const DEFAULT_FONT_URL  = '/fonts/Inter-Variable.ttf'
const DEFAULT_FONT_NAME = 'Inter Variable'
const ACCEPT = '.ttf,.otf,.woff,.woff2'

export default function Demo() {
	const [fontBuffer, setFontBuffer] = useState<Uint8Array<ArrayBuffer> | null>(null)
	const [fontName, setFontName]     = useState('')
	const [axes, setAxes]             = useState<AxisDefinition[]>([])
	const [instances, setInstances]   = useState<FontInstance[]>([])
	const [loadState, setLoadState]   = useState<LoadState>('idle')
	const [loadError, setLoadError]   = useState<string | null>(null)

	const [selected, setSelected]         = useState<Set<string>>(new Set())
	const [processing, setProcessing]     = useState(false)
	const [processError, setProcessError] = useState<string | null>(null)
	const [tooltip, setTooltip]           = useState<string | null>(null)
	const [hasDemoFont, setHasDemoFont]   = useState(false)

	const isLoadingRef = useRef(false)
	const containerRef = useRef<HTMLDivElement>(null)
	const warmedUpRef  = useRef(false)
	const styleRef     = useRef<HTMLStyleElement | null>(null)

	// Warmup ping on scroll-into-view
	useEffect(() => {
		const el = containerRef.current
		if (!el) return
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && !warmedUpRef.current) {
					warmedUpRef.current = true
					observer.disconnect()
					fetch('/api/demo/instances', {
						method: 'POST',
						headers: { 'Content-Type': 'application/octet-stream' },
						body: new Uint8Array([0]),
					}).catch(() => {})
				}
			},
			{ threshold: 0.1 },
		)
		observer.observe(el)
		return () => observer.disconnect()
	}, [])

	// Inject @font-face when font buffer changes so TextPreview can render it
	useEffect(() => {
		styleRef.current?.remove()
		setHasDemoFont(false)
		if (!fontBuffer) return

		const blob = new Blob([fontBuffer], { type: 'font/ttf' })
		const url  = URL.createObjectURL(blob)

		const style = document.createElement('style')
		style.textContent = `@font-face { font-family: "vf-demo"; src: url("${url}"); }`
		document.head.appendChild(style)
		styleRef.current = style
		setHasDemoFont(true)

		return () => {
			style.remove()
			URL.revokeObjectURL(url)
			setHasDemoFont(false)
		}
	}, [fontBuffer])

	const groups = useMemo(
		() => computeGroups(instances, selected, axes),
		[instances, selected, axes],
	)

	/** Selected instances that are alone in their group (no adjacent neighbours). */
	const isolatedInstances = useMemo(() => {
		const s = new Set<string>()
		for (const g of groups) if (g.instances.length === 1) s.add(g.instances[0].name)
		return s
	}, [groups])

	const loadFont = useCallback(async (buffer: Uint8Array<ArrayBuffer>, name: string) => {
		if (isLoadingRef.current) return
		isLoadingRef.current = true

		setLoadState('loading')
		setLoadError(null)
		setAxes([])
		setInstances([])
		setSelected(new Set())
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
			await loadFont(new Uint8Array(await res.arrayBuffer()), DEFAULT_FONT_NAME)
		} catch (err) {
			setLoadError(err instanceof Error ? err.message : 'Failed to load Inter Variable')
			setLoadState('error')
		}
	}, [loadState, loadFont])

	const handleFile = useCallback(
		async (file: File) => {
			await loadFont(
				new Uint8Array(await file.arrayBuffer()),
				file.name.replace(/\.(ttf|otf|woff2?)$/i, ''),
			)
		},
		[loadFont],
	)

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

	function toggleInstance(name: string) {
		setSelected((prev) => {
			const next = new Set(prev)
			if (next.has(name)) next.delete(name)
			else next.add(name)
			return next
		})
	}

	async function handleDownload() {
		if (!fontBuffer || !groups.length) return
		setProcessing(true)
		setProcessError(null)

		try {
			const configs = groups.map((group) => {
				const first = group.instances[0]
				const last  = group.instances[group.instances.length - 1]
				const name  = group.instances.length === 1 ? first.name : `${first.name}–${last.name}`
				const axesOut: Record<string, number | { min: number; max: number }> = {}
				for (const [tag, r] of Object.entries(group.axisRanges))
					axesOut[tag] = r.min === r.max ? r.min : r
				return { name, axes: axesOut }
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
				const blob  = new Blob([bytes], { type: 'font/ttf' })
				const url   = URL.createObjectURL(blob)
				const a     = document.createElement('a')
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

	return (
		<div ref={containerRef} className="w-full flex flex-col gap-10">

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
								or drop any variable font to explore its instances
							</p>
							{loadState === 'error' && loadError && (
								<p className="text-xs text-red-400">{loadError}</p>
							)}
						</div>
					)}
					{loadState === 'loading' && (
						<div className="flex flex-col gap-1">
							<p className="text-sm opacity-70 animate-pulse">Reading font instances…</p>
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

			{/* Instance selection grid */}
			{loadState === 'ready' && instances.length > 0 && (
				<div className="flex flex-col gap-3">
					<p className="text-xs opacity-35 uppercase tracking-widest">
						Select instances — adjacent selections merge into one output file
					</p>
					<div className="flex flex-wrap gap-2">
						{instances.map((inst) => {
							const isSelected = selected.has(inst.name)
							const isIsolated = isSelected && isolatedInstances.has(inst.name)

							return (
								<div key={inst.name} className="relative">
									<button
										onClick={() => toggleInstance(inst.name)}
										onMouseEnter={() => isIsolated && setTooltip(inst.name)}
										onMouseLeave={() => setTooltip(null)}
										className={[
											'flex flex-col gap-0.5 px-3 py-2 rounded-lg border text-left transition-all',
											isIsolated
												? 'border-amber-400/60 bg-amber-400/5'
												: isSelected
												? 'border-white/40 bg-white/5'
												: 'border-white/10 opacity-50 hover:opacity-80 hover:border-white/25',
										].join(' ')}
									>
										<span className="text-xs font-mono">{inst.name}</span>
										<span className="text-[10px] opacity-40 font-mono">
											{Object.entries(inst.coordinates)
												.map(([k, v]) => `${k} ${v}`)
												.join(' ')}
										</span>
									</button>

									{tooltip === inst.name && (
										<div className="absolute bottom-full left-0 mb-2 z-10 bg-[#0c1417] border border-amber-400/30 rounded-lg px-3 py-2 text-xs text-amber-300/80 whitespace-nowrap shadow-xl pointer-events-none">
											⚠ No adjacent neighbours selected — generates a separate file
										</div>
									)}
								</div>
							)
						})}
					</div>

					{selected.size > 0 && (
						<button
							onClick={() => setSelected(new Set())}
							className="self-start text-xs opacity-25 hover:opacity-60 transition-opacity"
						>
							Clear selection
						</button>
					)}

					{loadState === 'ready' && instances.length === 0 && (
						<p className="text-sm opacity-30 italic">
							This font has no named instances — use the axis controls below
						</p>
					)}
				</div>
			)}

			{/* Group previews */}
			{groups.length > 0 && (
				<div className="flex flex-col gap-6">
					<p className="text-xs opacity-35 uppercase tracking-widest">
						{groups.length === 1 ? '1 output file' : `${groups.length} output files`}
					</p>

					{groups.map((group, i) => {
						const first = group.instances[0]
						const last  = group.instances[group.instances.length - 1]
						const label = group.instances.length === 1
							? first.name
							: `${first.name} → ${last.name}`
						const isIsolated = group.instances.length === 1

						return (
							<div
								key={i}
								className={[
									'rounded-xl border px-5 pt-5 pb-5 flex flex-col gap-5',
									isIsolated ? 'border-amber-400/25' : 'border-white/10',
								].join(' ')}
							>
								{/* Header */}
								<div className="flex flex-col gap-1">
									<div className="flex items-center gap-2 flex-wrap">
										<span className="text-sm font-mono opacity-80">{label}</span>
										{isIsolated && (
											<span className="text-xs text-amber-400/60">
												⚠ isolated — single-instance file
											</span>
										)}
									</div>
									{group.collateral.length > 0 && (
										<p className="text-xs text-amber-400/60">
											⚠ range also covers{' '}
											<span className="font-mono">{group.collateral.join(', ')}</span>
										</p>
									)}
								</div>

								{/* Text preview */}
								{hasDemoFont && (
									<TextPreview axes={axes} axisRanges={group.axisRanges} />
								)}

								{/* Axis range bars */}
								<div className="flex flex-col gap-2">
									{axes.map((axis) => (
										<AxisRangeBar
											key={axis.tag}
											axis={axis}
											range={group.axisRanges[axis.tag] ?? { min: axis.minimum, max: axis.maximum }}
										/>
									))}
								</div>

								{/* Instance list */}
								<p className="text-[10px] font-mono opacity-20">
									{group.instances.map((inst) => inst.name).join(' · ')}
								</p>
							</div>
						)
					})}
				</div>
			)}

			{/* Download */}
			{groups.length > 0 && (
				<div className="flex flex-col gap-2">
					{processError && (
						<p className="text-xs text-red-400">{processError}</p>
					)}
					<div className="flex items-center gap-4 flex-wrap">
						<button
							onClick={handleDownload}
							disabled={processing}
							className="text-sm px-5 py-2.5 rounded-full border border-white/20 hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
						>
							{processing
								? 'Processing… (may take up to 30 s)'
								: `Download ${groups.length === 1 ? '1 restricted VF' : `${groups.length} restricted VFs`}`}
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
