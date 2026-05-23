'use client'
// Demo.tsx — instance-based vf-clamp demo: select named instances, preview restricted VF groups, download.

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import type { AxisDefinition, FontInstance, OutputFormat } from '@liiift-studio/vf-clamp'

// ── Types ─────────────────────────────────────────────────────────────────────

/** A group of adjacent selected instances that produces one VF output file. */
interface InstanceGroup {
	instances: FontInstance[]
	axisRanges: Record<string, { min: number; max: number }>
	/** Unselected instances whose coordinates fall inside this group's axis hull. */
	collateral: string[]
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

const STAGE_LABELS = [
	'Sending font to server…',
	'Starting fonttools engine…',
	'Restricting axis ranges…',
	'Packaging output files…',
] as const

// ── Helpers ───────────────────────────────────────────────────────────────────

function toBase64(buf: Uint8Array<ArrayBuffer>): string {
	let binary = ''
	const chunk = 0x8000
	for (let i = 0; i < buf.length; i += chunk)
		binary += String.fromCharCode(...buf.subarray(i, i + chunk))
	return btoa(binary)
}

const FORMAT_MIME: Record<OutputFormat, string> = {
	ttf:   'font/ttf',
	otf:   'font/otf',
	woff:  'font/woff',
	woff2: 'font/woff2',
}

const FORMAT_EXT: Record<OutputFormat, string> = {
	ttf:   'ttf',
	otf:   'otf',
	woff:  'woff',
	woff2: 'woff2',
}

const NAME_ID_LABELS: Record<number, string> = {
	1:  'Family',
	2:  'Subfamily',
	4:  'Full name',
	6:  'PostScript',
	16: 'Pref. family',
	17: 'Pref. subfamily',
}

/** Parse OpenType name table from a TTF/OTF buffer, returning interesting nameIDs. */
function parseNameTable(buffer: ArrayBuffer): Array<{ nameId: number; label: string; value: string }> {
	try {
		const view      = new DataView(buffer)
		const numTables = view.getUint16(4)
		let nameOffset  = -1
		for (let i = 0; i < numTables; i++) {
			const base = 12 + i * 16
			const tag  = String.fromCharCode(view.getUint8(base), view.getUint8(base + 1), view.getUint8(base + 2), view.getUint8(base + 3))
			if (tag === 'name') { nameOffset = view.getUint32(base + 8); break }
		}
		if (nameOffset < 0) return []

		const count        = view.getUint16(nameOffset + 2)
		const stringOffset = view.getUint16(nameOffset + 4)
		const INTERESTING  = new Set([1, 2, 4, 6, 16, 17])
		const byId         = new Map<number, { platformId: number; value: string }>()

		for (let i = 0; i < count; i++) {
			const rec        = nameOffset + 6 + i * 12
			const platformId = view.getUint16(rec)
			const nameId     = view.getUint16(rec + 6)
			const length     = view.getUint16(rec + 8)
			const strOff     = view.getUint16(rec + 10)
			if (!INTERESTING.has(nameId)) continue
			const existing = byId.get(nameId)
			if (existing && existing.platformId === 3) continue // already have Windows/Unicode entry

			const strStart = nameOffset + stringOffset + strOff
			let value = ''
			if (platformId === 3) {
				for (let j = 0; j < length; j += 2) value += String.fromCharCode(view.getUint16(strStart + j))
			} else {
				for (let j = 0; j < length; j++) value += String.fromCharCode(view.getUint8(strStart + j))
			}
			byId.set(nameId, { platformId, value })
		}

		return Array.from(byId.entries())
			.sort((a, b) => a[0] - b[0])
			.map(([nameId, { value }]) => ({ nameId, label: NAME_ID_LABELS[nameId] ?? `ID ${nameId}`, value }))
	} catch {
		return []
	}
}

/** Generate a vf-clamp npm code snippet from the current groups. */
function generateCode(groups: InstanceGroup[], fontName: string, format: OutputFormat): string {
	if (!groups.length) return ''

	const safe = fontName.replace(/\s+/g, '-') || 'MyFont-VF'
	const ext  = FORMAT_EXT[format]

	const outputLines = groups.flatMap((group) => {
		const first = group.instances[0]
		const last  = group.instances[group.instances.length - 1]
		const name  = group.instances.length === 1 ? first.name : compactName(first.name, last.name)
		const instanceList = group.instances.map((i) => `        '${i.name}',`).join('\n')
		return [
			`    {`,
			`      name: '${name}',`,
			`      instances: [`,
			instanceList,
			`      ],`,
			`    },`,
		]
	})

	const formatLine = format !== 'ttf' ? [`  format: '${format}',`] : []

	return [
		`import { clampFont } from '@liiift-studio/vf-clamp'`,
		`import { readFile, writeFile } from 'fs/promises'`,
		``,
		`const source = await readFile('${safe}.ttf')`,
		``,
		`const results = await clampFont(source, {`,
		...formatLine,
		`  outputs: [`,
		...outputLines,
		`  ],`,
		`})`,
		``,
		`for (const result of results) {`,
		`  await writeFile(\`\${result.name} VF.${ext}\`, result.buffer)`,
		`}`,
	].join('\n')
}

/** Axes that define weight or italic variation — excluded from subfamily grouping. */
const SUBFAMILY_EXCLUDE = new Set(['wght', 'ital', 'slnt'])

function longestCommonPrefix(strings: string[]): string {
	if (!strings.length) return ''
	let prefix = strings[0]
	for (const s of strings.slice(1)) {
		while (prefix && !s.startsWith(prefix)) prefix = prefix.slice(0, -1)
	}
	return prefix
}

/**
 * Compact two endpoint instance names into a shared-prefix form.
 * "Encode Sans Light" + "Encode Sans Bold" → "Encode Sans Light-Bold"
 * Falls back to "First–Last" if there is no shared word-level prefix.
 */
function compactName(first: string, last: string): string {
	if (first === last) return first
	let prefix = ''
	const minLen = Math.min(first.length, last.length)
	for (let i = 0; i < minLen; i++) {
		if (first[i] === last[i]) prefix += first[i]
		else break
	}
	const lastSpace = prefix.lastIndexOf(' ')
	prefix = lastSpace >= 0 ? prefix.slice(0, lastSpace + 1) : ''
	if (!prefix) return `${first}–${last}`
	const a = first.slice(prefix.length).trim()
	const b = last.slice(prefix.length).trim()
	const base = prefix.trim()
	if (!a && !b) return base
	if (!a) return `${base} ${b}`
	if (!b) return `${base} ${a}`
	return `${base} ${a}-${b}`
}

/**
 * Group named instances into subfamilies.
 * The grouping axis is the non-weight, non-italic axis with the fewest distinct
 * values (most "subfamily-like"). The label is the longest common name prefix
 * of the instances in each group.
 */
function groupBySubfamily(
	instances: FontInstance[],
	axes: AxisDefinition[],
): Array<{ label: string; axisValue: number; hasNamePrefix: boolean; key: string; axisTag: string | null; instances: FontInstance[] }> {
	const candidates = axes
		.filter((ax) => !SUBFAMILY_EXCLUDE.has(ax.tag))
		.map((ax) => {
			const vals = [
				...new Set(instances.map((i) => i.coordinates[ax.tag] ?? ax.default)),
			].sort((a, b) => a - b)
			return { ax, vals }
		})
		.filter(({ vals }) => vals.length > 1)
		.sort((a, b) => a.vals.length - b.vals.length)

	if (!candidates.length) {
		return [{ label: '', axisValue: 0, hasNamePrefix: false, key: 'all', axisTag: null, instances }]
	}

	const { ax: groupAxis, vals } = candidates[0]

	return vals.map((val) => {
		const members = instances.filter(
			(i) => (i.coordinates[groupAxis.tag] ?? groupAxis.default) === val,
		)
		const prefix = longestCommonPrefix(members.map((i) => i.name)).trim()
		return {
			label: prefix || `${groupAxis.tag} ${val}`,
			axisValue: val,
			hasNamePrefix: prefix.length > 0,
			key: `${groupAxis.tag}-${val}`,
			axisTag: groupAxis.tag,
			instances: members,
		}
	})
}

/** The axis with the widest normalised range — used as the primary sort key. */
function primaryAxis(axes: AxisDefinition[]): AxisDefinition | null {
	if (!axes.length) return null
	return axes.reduce((best, a) =>
		a.maximum - a.minimum > best.maximum - best.minimum ? a : best,
	)
}

/**
 * Group selected instances into output VFs.
 *
 * Strategy: first attempt to combine ALL selected instances into one group by
 * computing their global bounding-box hull. If no unselected instance falls
 * strictly inside that hull ("global collateral"), one output VF covers every
 * selection — e.g. Condensed Thin + SemiCondensed Thin collapse into a single
 * wdth-variable font because no instance sits between wdth 75 and 87.5.
 *
 * If global collateral exists, fall back to the adjacency algorithm: sort
 * instances by secondary axes then the primary (widest-range) axis and build
 * contiguous runs of selected instances, splitting whenever an unselected
 * instance interrupts the sequence.
 */
function computeGroups(
	instances: FontInstance[],
	selected: Set<string>,
	axes: AxisDefinition[],
): InstanceGroup[] {
	if (!selected.size || !axes.length) return []

	const primary = primaryAxis(axes)
	if (!primary) return []

	const selectedInstances = instances.filter((i) => selected.has(i.name))

	// ── Step 1: global hull of all selected instances ────────────────────────
	const globalHull: Record<string, { min: number; max: number }> = {}
	for (const axis of axes) {
		const vals = selectedInstances.map((i) => i.coordinates[axis.tag] ?? axis.default)
		globalHull[axis.tag] = { min: Math.min(...vals), max: Math.max(...vals) }
	}

	// ── Step 2: unselected instances inside the global hull ──────────────────
	const globalCollateral = instances.filter((inst) => {
		if (selected.has(inst.name)) return false
		return axes.every((axis) => {
			const v = inst.coordinates[axis.tag] ?? axis.default
			const r = globalHull[axis.tag]
			// strictly inside: touches the boundary is acceptable (it won't
			// add design-space the selection already covers)
			return v >= r.min && v <= r.max
		})
	})

	// ── Step 3: no collateral → one group covers everything ──────────────────
	if (globalCollateral.length === 0) {
		return [{ instances: selectedInstances, axisRanges: globalHull, collateral: [] }]
	}

	// ── Step 4: collateral exists → adjacency fallback ───────────────────────

	// Secondary axes sorted by number of distinct instance values descending.
	const secondaryAxes = axes
		.filter((ax) => ax.tag !== primary.tag)
		.sort((ax1, ax2) => {
			const d1 = new Set(instances.map((i) => i.coordinates[ax1.tag] ?? ax1.default)).size
			const d2 = new Set(instances.map((i) => i.coordinates[ax2.tag] ?? ax2.default)).size
			return d2 - d1
		})

	// Sort by secondary axes first, then primary.
	const sorted = [...instances].sort((a, b) => {
		for (const axis of secondaryAxes) {
			const av = a.coordinates[axis.tag] ?? axis.default
			const bv = b.coordinates[axis.tag] ?? axis.default
			if (av !== bv) return av - bv
		}
		return (a.coordinates[primary.tag] ?? primary.default) -
			(b.coordinates[primary.tag] ?? primary.default)
	})

	// Build runs of consecutive selected instances.
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

	// Per run: compute hull and find collateral.
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
	const [progress, setProgress]     = useState(0)
	const [editing, setEditing]       = useState(false)
	const [customText, setCustomText] = useState('')
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

	const midpointSettings = useMemo(() => {
		return axes
			.map((axis) => {
				const r = axisRanges[axis.tag]
				if (!r) return null
				return `'${axis.tag}' ${((r.min + r.max) / 2).toFixed(1)}`
			})
			.filter(Boolean)
			.join(', ')
	}, [axes, axisRanges])

	return (
		<div className="relative group/preview">
			{editing ? (
				<textarea
					// eslint-disable-next-line jsx-a11y/no-autofocus
					autoFocus
					value={customText}
					onChange={(e) => setCustomText(e.target.value)}
					placeholder="Type here…"
					rows={2}
					style={{ fontFamily: '"vf-demo", sans-serif', fontVariationSettings: midpointSettings, resize: 'none' }}
					className="w-full bg-transparent text-4xl leading-tight opacity-90 placeholder:opacity-20 focus:outline-none"
				/>
			) : (
				<p
					style={{ fontFamily: '"vf-demo", sans-serif', fontVariationSettings: variationSettings }}
					className="text-4xl leading-tight opacity-90 select-none overflow-hidden"
					aria-hidden="true"
				>
					{customText || 'Aa Bb 012'}
				</p>
			)}
			<button
				onClick={() => setEditing((v) => !v)}
				className="absolute top-0 right-0 text-[10px] opacity-0 group-hover/preview:opacity-30 hover:!opacity-60 transition-opacity"
			>
				{editing ? 'done' : 'edit'}
			</button>
		</div>
	)
}

// ── Main component ────────────────────────────────────────────────────────────

const DEFAULT_FONT_URL  = '/fonts/EncodeSans.ttf'
const DEFAULT_FONT_NAME = 'Encode Sans'
const ACCEPT = '.ttf,.otf,.woff,.woff2'

export default function Demo() {
	const [fontBuffer, setFontBuffer] = useState<Uint8Array<ArrayBuffer> | null>(null)
	const [fontName, setFontName]     = useState('')
	const [axes, setAxes]             = useState<AxisDefinition[]>([])
	const [instances, setInstances]   = useState<FontInstance[]>([])
	const [loadState, setLoadState]   = useState<LoadState>('idle')
	const [loadError, setLoadError]   = useState<string | null>(null)

	const [selected, setSelected]               = useState<Set<string>>(new Set())
	const [processing, setProcessing]           = useState(false)
	const [processingStage, setProcessingStage] = useState(0)
	const [processingProgress, setProcessingProgress] = useState(0)
	const [processError, setProcessError]       = useState<string | null>(null)
	const [tooltip, setTooltip]                 = useState<string | null>(null)
	const [hasDemoFont, setHasDemoFont]         = useState(false)
	const [showCode, setShowCode]               = useState(false)
	const [showAdvanced, setShowAdvanced]       = useState(false)
	const [axisOverrides, setAxisOverrides]     = useState<Record<string, { min: number; max: number }>>({})
	const [outputFormat, setOutputFormat]       = useState<OutputFormat>('ttf')
	const [nameTables, setNameTables]           = useState<Record<number, Array<{ nameId: number; label: string; value: string }>>>({})
	const [expandedNameTable, setExpandedNameTable] = useState<number | null>(null)

	const isLoadingRef       = useRef(false)
	const containerRef       = useRef<HTMLDivElement>(null)
	const warmedUpRef        = useRef(false)
	const styleRef           = useRef<HTMLStyleElement | null>(null)
	const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

	/**
	 * Axes where every named instance shares the same coordinate value — i.e. the
	 * named-instance system doesn't provide variation for them. Exposed in the
	 * Advanced panel so the user can manually add a range.
	 */
	const freeAxes = useMemo(() => {
		if (!axes.length || !instances.length) return []
		return axes.filter((axis) => {
			const vals = new Set(instances.map((i) => i.coordinates[axis.tag] ?? axis.default))
			return vals.size <= 1
		})
	}, [axes, instances])

	const subfamilyGroups = useMemo(
		() => groupBySubfamily(instances, axes),
		[instances, axes],
	)

	const groups = useMemo(() => {
		const base = computeGroups(instances, selected, axes)
		if (!Object.keys(axisOverrides).length) return base
		return base.map((group) => ({
			...group,
			axisRanges: { ...group.axisRanges, ...axisOverrides },
		}))
	}, [instances, selected, axes, axisOverrides])

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
		setAxisOverrides({})
		setShowAdvanced(false)
		setNameTables({})
		setExpandedNameTable(null)
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
			setLoadError(err instanceof Error ? err.message : 'Failed to load Encode Sans')
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
		setNameTables({})
		setExpandedNameTable(null)
	}

	async function handleDownload() {
		if (!fontBuffer || !groups.length) return
		setProcessing(true)
		setProcessError(null)
		setProcessingStage(0)
		setProcessingProgress(0)

		// Simulated staged progress: grows quickly then slows asymptotically toward 92%
		let elapsed = 0
		const TICK_MS = 250
		progressIntervalRef.current = setInterval(() => {
			elapsed += TICK_MS
			if      (elapsed >= 22000) setProcessingStage(3)
			else if (elapsed >= 7000)  setProcessingStage(2)
			else if (elapsed >= 1500)  setProcessingStage(1)
			setProcessingProgress(92 * (1 - Math.exp(-elapsed / 12000)))
		}, TICK_MS)

		try {
			const outputs = groups.map((group) => {
				const first = group.instances[0]
				const last  = group.instances[group.instances.length - 1]
				const name  = group.instances.length === 1 ? first.name : compactName(first.name, last.name)
				return { name, instances: group.instances.map((i) => i.name) }
			})

			const res = await fetch('/api/demo/clamp', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ font: toBase64(fontBuffer), outputs, format: outputFormat }),
			})
			const json = await res.json()
			if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)

			setProcessingProgress(100)
			setProcessingStage(3)

			const parsedTables: Record<number, Array<{ nameId: number; label: string; value: string }>> = {}
			;(json.results as Array<{ name: string; data: string; format?: string }>).forEach((result, idx) => {
				const fmt   = (result.format ?? outputFormat) as OutputFormat
				const bytes = Uint8Array.from(atob(result.data), (c) => c.charCodeAt(0))

				const blob = new Blob([bytes], { type: FORMAT_MIME[fmt] })
				const url  = URL.createObjectURL(blob)
				const a    = document.createElement('a')
				a.href = url
				a.download = `${result.name} VF.${FORMAT_EXT[fmt]}`
				a.click()
				URL.revokeObjectURL(url)

				if (fmt === 'ttf' || fmt === 'otf') {
					parsedTables[idx] = parseNameTable(bytes.buffer)
				}
			})
			setNameTables(parsedTables)
		} catch (err) {
			setProcessError(err instanceof Error ? err.message : 'Processing failed')
		} finally {
			if (progressIntervalRef.current) {
				clearInterval(progressIntervalRef.current)
				progressIntervalRef.current = null
			}
			setProcessing(false)
			setProcessingProgress(0)
			setProcessingStage(0)
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
									Encode Sans
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
					{loadState === 'ready' ? 'Swap font' : 'Browse font'}
					<input
						type="file"
						accept={ACCEPT}
						onChange={handleInputChange}
						className="sr-only"
						aria-label="Upload a variable font"
					/>
				</label>
			</div>

			{/* Instance selection grid — grouped by subfamily */}
			{loadState === 'ready' && instances.length > 0 && (
				<div className="flex flex-col gap-4">
					<p className="text-xs opacity-35 uppercase tracking-widest">
						Named instances — adjacent selections merge into one output file
					</p>

					{subfamilyGroups.map((group) => (
						<div key={group.key} className="flex flex-col gap-2">
							{group.label && (
								<p className="text-[10px] font-mono opacity-30 uppercase tracking-widest">
									{group.label}
									{group.hasNamePrefix && (
										<span className="opacity-50 normal-case tracking-normal ml-1.5">
											({group.axisTag} {group.axisValue})
										</span>
									)}
								</p>
							)}
							<div className="flex flex-wrap gap-2">
								{group.instances.map((inst) => {
										const isSelected = selected.has(inst.name)
										const isIsolated = isSelected && isolatedInstances.has(inst.name)

										// Show only non-group-axis coordinates in the button subtitle
										const coordEntries = Object.entries(inst.coordinates).filter(
											([k]) => k !== group.axisTag,
										)

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
													{coordEntries.length > 0 && (
														<span className="text-[10px] opacity-40 font-mono">
															{coordEntries.map(([k, v]) => `${k} ${v}`).join(' ')}
														</span>
													)}
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
							</div>
						)
					)}

					{selected.size > 0 && (
						<button
							onClick={() => setSelected(new Set())}
							className="self-start text-xs opacity-25 hover:opacity-60 transition-opacity"
						>
							Clear selection
						</button>
					)}
				</div>
			)}

			{/* Advanced: free axes */}
			{loadState === 'ready' && freeAxes.length > 0 && (
				<div className="flex flex-col gap-3">
					<button
						onClick={() => setShowAdvanced((v) => !v)}
						className="self-start flex items-center gap-1.5 text-xs opacity-30 hover:opacity-60 transition-opacity"
					>
						<span>{showAdvanced ? '▾' : '▸'}</span>
						<span>Advanced</span>
					</button>
					{showAdvanced && (
						<div className="flex flex-col gap-4 pl-4 border-l border-white/10">
							<p className="text-xs opacity-35 leading-relaxed max-w-sm">
								{freeAxes.length === 1
									? `The ${freeAxes[0].name} axis isn't set by named instances — add a range to include it in all output files.`
									: `These axes aren't set by named instances — add ranges to include them in all output files.`}
							</p>
							{freeAxes.map((axis) => {
								const override = axisOverrides[axis.tag]
								const curMin = override?.min ?? axis.default
								const curMax = override?.max ?? axis.default
								return (
									<div key={axis.tag} className="flex items-center gap-3 flex-wrap text-xs">
										<span className="font-mono opacity-40 w-10 shrink-0">{axis.tag}</span>
										<span className="opacity-30 shrink-0">{axis.name}</span>
										<div className="flex items-center gap-2">
											<input
												type="number"
												min={axis.minimum}
												max={curMax}
												value={curMin}
												onChange={(e) => {
													const min = Math.max(axis.minimum, Math.min(Number(e.target.value), curMax))
													setAxisOverrides((prev) => ({ ...prev, [axis.tag]: { min, max: curMax } }))
												}}
												className="w-20 bg-white/5 border border-white/10 rounded px-2 py-1 font-mono text-center focus:outline-none focus:border-white/30 transition-colors"
											/>
											<span className="opacity-20">–</span>
											<input
												type="number"
												min={curMin}
												max={axis.maximum}
												value={curMax}
												onChange={(e) => {
													const max = Math.min(axis.maximum, Math.max(Number(e.target.value), curMin))
													setAxisOverrides((prev) => ({ ...prev, [axis.tag]: { min: curMin, max } }))
												}}
												className="w-20 bg-white/5 border border-white/10 rounded px-2 py-1 font-mono text-center focus:outline-none focus:border-white/30 transition-colors"
											/>
										</div>
										<span className="opacity-20 font-mono tabular-nums">{axis.minimum}–{axis.maximum}</span>
										{override && (
											<button
												onClick={() => setAxisOverrides((prev) => { const next = { ...prev }; delete next[axis.tag]; return next })}
												className="opacity-20 hover:opacity-60 transition-opacity"
												aria-label={`Reset ${axis.name}`}
											>
												×
											</button>
										)}
									</div>
								)
							})}
						</div>
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
						const first      = group.instances[0]
						const last       = group.instances[group.instances.length - 1]
						const label      = group.instances.length === 1
							? first.name
							: `${first.name} → ${last.name}`
						const name       = group.instances.length === 1 ? first.name : compactName(first.name, last.name)
						const filename   = `${name} VF.${FORMAT_EXT[outputFormat]}`
						const isIsolated = group.instances.length === 1
						const nameTable  = nameTables[i]

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
									<p className="text-[10px] font-mono opacity-25">{filename}</p>
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

								{/* Name table — available after download */}
								{nameTable && nameTable.length > 0 && (
									<div className="flex flex-col gap-2">
										<button
											onClick={() => setExpandedNameTable(expandedNameTable === i ? null : i)}
											className="self-start flex items-center gap-1 text-[10px] opacity-30 hover:opacity-60 transition-opacity"
										>
											<span>{expandedNameTable === i ? '▾' : '▸'}</span>
											<span>Name table</span>
										</button>
										{expandedNameTable === i && (
											<table className="w-full text-[10px] font-mono">
												<tbody>
													{nameTable.map(({ nameId, label: nameLabel, value }) => (
														<tr key={nameId} className="border-t border-white/5">
															<td className="py-1 pr-4 opacity-30 shrink-0 whitespace-nowrap">{nameLabel}</td>
															<td className="py-1 opacity-60 break-all">{value}</td>
														</tr>
													))}
												</tbody>
											</table>
										)}
									</div>
								)}
							</div>
						)
					})}
				</div>
			)}

			{/* Download + Code */}
			{groups.length > 0 && (
				<div className="flex flex-col gap-4">

					{/* Download */}
					<div className="flex flex-col gap-3">
						{processError && (
							<p className="text-xs text-red-400">{processError}</p>
						)}
						<div className="flex flex-wrap items-center gap-3">
							<button
								onClick={handleDownload}
								disabled={processing}
								className="text-sm px-5 py-2.5 rounded-full border border-white/20 hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
							>
								{processing
									? STAGE_LABELS[processingStage]
									: `Download ${groups.length === 1 ? '1 restricted VF' : `${groups.length} restricted VFs`}`}
							</button>
							{/* Format selector */}
							{!processing && (
								<div className="flex items-center rounded-full border border-white/15 overflow-hidden text-xs">
									{(['ttf', 'otf', 'woff', 'woff2'] as OutputFormat[]).map((fmt) => (
										<button
											key={fmt}
											onClick={() => setOutputFormat(fmt)}
											className={[
												'px-3 py-1.5 font-mono transition-colors',
												outputFormat === fmt
													? 'bg-white/10 opacity-100'
													: 'opacity-30 hover:opacity-60',
											].join(' ')}
										>
											{fmt}
										</button>
									))}
								</div>
							)}
						</div>
						{!processing && (
							<div className="flex flex-col gap-0.5">
								{groups.map((group, i) => {
									const first = group.instances[0]
									const last  = group.instances[group.instances.length - 1]
									const name  = group.instances.length === 1 ? first.name : compactName(first.name, last.name)
									return (
										<p key={i} className="text-[10px] font-mono opacity-20">
											{name} VF.{FORMAT_EXT[outputFormat]}
										</p>
									)
								})}
							</div>
						)}
						{processing && (
							<div className="flex flex-col gap-1.5">
								<div className="h-0.5 bg-white/10 rounded-full overflow-hidden w-full max-w-xs">
									<div
										className="h-full bg-white/50 rounded-full transition-all duration-500 ease-out"
										style={{ width: `${processingProgress}%` }}
									/>
								</div>
								<p className="text-[10px] opacity-25">
									First run includes fonttools engine startup (~10 s)
								</p>
							</div>
						)}
					</div>

					{/* See code toggle */}
					<div className="flex flex-col gap-3">
						<button
							onClick={() => setShowCode((v) => !v)}
							className="self-start text-xs px-3 py-1.5 rounded-full border border-white/15 hover:bg-white/5 transition-colors opacity-60 hover:opacity-100"
						>
							{showCode ? 'Hide code' : 'See code'}
						</button>
						{showCode && (
							<pre className="bg-white/5 rounded-xl p-4 overflow-x-auto text-xs leading-relaxed font-mono opacity-75 whitespace-pre">
								<code>{generateCode(groups, fontName, outputFormat)}</code>
							</pre>
						)}
					</div>
				</div>
			)}
		</div>
	)
}
