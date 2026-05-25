'use client'
// Demo.tsx — instance-based vf-clamp demo: select named instances, preview restricted VF groups, download.

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import type { AxisDefinition, FontInstance, OutputFormat } from '@liiift-studio/vf-clamp'

// ── Types ─────────────────────────────────────────────────────────────────────

/** A group of selected instances that produces one output font file. (#5) */
interface InstanceGroup {
	instances: FontInstance[]
	axisRanges: Record<string, { min: number; max: number }>
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

const STAGE_LABELS = [
	'Sending font to server…',
	'Starting fonttools engine…',
	'Restricting axis ranges…',
	'Packaging output files…',
] as const

// ── Helpers ───────────────────────────────────────────────────────────────────


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

/** Format a byte count as a human-readable string. */
function formatBytes(n: number): string {
	if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
	if (n >= 1024) return `${Math.round(n / 1024)} KB`
	return `${n} B`
}

const NAME_ID_LABELS: Record<number, string> = {
	1:  'Family',
	2:  'Subfamily',
	4:  'Full name',
	6:  'PostScript',
	16: 'Pref. family',
	17: 'Pref. subfamily',
}

/** Parse OpenType name table from a TTF/OTF buffer, returning interesting nameIDs. (#10) */
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
		const utf16Decoder = new TextDecoder('utf-16be')
		const macDecoder   = new TextDecoder('macintosh')

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
			const slice    = new Uint8Array(buffer, strStart, length)
			const value    = platformId === 3
				? utf16Decoder.decode(slice) // handles surrogate pairs correctly
				: macDecoder.decode(slice)    // Mac Roman differs from Latin-1 in 0x80–0xFF
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
		`  await writeFile(\`\${result.name}.${ext}\`, result.buffer)`,
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
 * Compact two endpoint instance names using shared word-level prefix and/or suffix.
 *   "Encode Sans Light" + "Encode Sans Bold"       → "Encode Sans Light-Bold"
 *   "Condensed Light"   + "SemiCondensed Light"    → "Condensed-SemiCondensed Light"
 *   "Condensed Thin"    + "Condensed Black"        → "Condensed Thin-Black"
 * Falls back to "First–Last" when names share no words.
 */
function compactName(first: string, last: string): string {
	if (first === last) return first
	const fw = first.split(' ')
	const lw = last.split(' ')

	// Common leading words
	let prefixLen = 0
	while (prefixLen < fw.length && prefixLen < lw.length && fw[prefixLen] === lw[prefixLen]) prefixLen++

	// Common trailing words (not overlapping the prefix)
	let suffixLen = 0
	while (
		suffixLen < fw.length - prefixLen &&
		suffixLen < lw.length - prefixLen &&
		fw[fw.length - 1 - suffixLen] === lw[lw.length - 1 - suffixLen]
	) suffixLen++

	const prefix = fw.slice(0, prefixLen).join(' ')
	const suffix = suffixLen > 0 ? fw.slice(fw.length - suffixLen).join(' ') : ''
	const a      = fw.slice(prefixLen, fw.length - (suffixLen || 0)).join(' ')
	const b      = lw.slice(prefixLen, lw.length - (suffixLen || 0)).join(' ')

	if (!a && !b) return [prefix, suffix].filter(Boolean).join(' ') || `${first}–${last}`
	const middle = a && b ? `${a}-${b}` : (a || b)
	return [prefix, middle, suffix].filter(Boolean).join(' ')
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
 * Group selected instances into output fonts.
 *
 * Strategy: greedy pairwise hull-merging.
 * 1. Try the global hull first — if all selected instances together have no
 *    unselected collateral, return one group.
 * 2. Otherwise start with one group per instance, then repeatedly merge any
 *    two groups whose combined hull contains no unselected instances. This
 *    handles cross-width same-weight pairs that the old linear-adjacency
 *    algorithm incorrectly split apart.
 * 3. Groups are sorted by their primary-axis range minimum for stable output.
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

	// Inner helpers so we don't repeat the hull/collateral logic.
	function makeHull(group: FontInstance[]): Record<string, { min: number; max: number }> {
		const h: Record<string, { min: number; max: number }> = {}
		for (const axis of axes) {
			const vals = group.map((i) => i.coordinates[axis.tag] ?? axis.default)
			h[axis.tag] = { min: Math.min(...vals), max: Math.max(...vals) }
		}
		return h
	}

	function hasCollateral(h: Record<string, { min: number; max: number }>): boolean {
		return instances.some((inst) => {
			if (selected.has(inst.name)) return false
			return axes.every((axis) => {
				const v = inst.coordinates[axis.tag] ?? axis.default
				const r = h[axis.tag]
				return v >= r.min && v <= r.max
			})
		})
	}

	// ── Step 1: try one group for everything ────────────────────────────────
	const globalHull = makeHull(selectedInstances)
	if (!hasCollateral(globalHull)) {
		return [{ instances: selectedInstances, axisRanges: globalHull }]
	}

	// ── Step 2: greedy pairwise merging ─────────────────────────────────────
	// Only merge two buckets when their combined hull contains no unselected instances.
	// By construction every resulting bucket has empty collateral, so we don't
	// store it — the collateral warning in the UI was dead code. (#8)
	type Bucket = { insts: FontInstance[]; h: Record<string, { min: number; max: number }> }
	const buckets: Bucket[] = selectedInstances.map((inst) => ({
		insts: [inst],
		h: makeHull([inst]),
	}))

	let merged = true
	while (merged) {
		merged = false
		outer: for (let i = 0; i < buckets.length; i++) {
			for (let j = i + 1; j < buckets.length; j++) {
				const combined = [...buckets[i].insts, ...buckets[j].insts]
				const combinedHull = makeHull(combined)
				if (!hasCollateral(combinedHull)) {
					buckets[i] = { insts: combined, h: combinedHull }
					buckets.splice(j, 1)
					merged = true
					break outer
				}
			}
		}
	}

	// ── Step 3: sort instances within each bucket, then sort buckets ─────────
	const secondaryAxes = axes
		.filter((ax) => ax.tag !== primary.tag)
		.sort((ax1, ax2) => {
			const d1 = new Set(instances.map((i) => i.coordinates[ax1.tag] ?? ax1.default)).size
			const d2 = new Set(instances.map((i) => i.coordinates[ax2.tag] ?? ax2.default)).size
			return d2 - d1
		})

	const primaryTag = primary.tag

	function sortInsts(insts: FontInstance[]): FontInstance[] {
		return [...insts].sort((a, b) => {
			for (const axis of secondaryAxes) {
				const av = a.coordinates[axis.tag] ?? axis.default
				const bv = b.coordinates[axis.tag] ?? axis.default
				if (av !== bv) return av - bv
			}
			return (a.coordinates[primaryTag] ?? primary!.default) - (b.coordinates[primaryTag] ?? primary!.default)
		})
	}

	buckets.sort((ga, gb) => ga.h[primaryTag].min - gb.h[primaryTag].min)

	return buckets.map((bucket) => ({
		instances: sortInsts(bucket.insts),
		axisRanges: bucket.h,
	}))
}

// ── Helpers used in render ────────────────────────────────────────────────────

/** True if the group's output font is actually variable (at least one axis has a non-zero range). */
function groupIsVariable(group: InstanceGroup, axes: AxisDefinition[]): boolean {
	return axes.some((axis) => {
		const r = group.axisRanges[axis.tag]
		return r !== undefined && r.min < r.max
	})
}

/** Filename stem + extension for a group, omitting "VF" for pinned (non-variable) outputs. */
function groupFilename(group: InstanceGroup, axes: AxisDefinition[], ext: string): string {
	const first = group.instances[0]
	const last  = group.instances[group.instances.length - 1]
	const name  = group.instances.length === 1 ? first.name : compactName(first.name, last.name)
	return groupIsVariable(group, axes) ? `${name} VF.${ext}` : `${name}.${ext}`
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

/**
 * Text specimen that animates through the axis range using CSS font-variation-settings.
 * Receives `progress` (0–1 ping-pong) from the parent so all group cards share
 * a single RAF loop instead of each running their own. (#1)
 */
function TextPreview({
	axes,
	axisRanges,
	progress,
}: {
	axes: AxisDefinition[]
	axisRanges: Record<string, { min: number; max: number }>
	progress: number
}) {
	const [editing, setEditing]       = useState(false)
	const [customText, setCustomText] = useState('')

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
		<div className="flex items-start gap-3 group/preview">
			<div className="flex-1 min-w-0">
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
			</div>
			<button
				onClick={() => setEditing((v) => !v)}
				aria-label={editing ? 'Finish editing preview text' : 'Edit preview text'}
				className="shrink-0 mt-2 p-1.5 rounded opacity-25 group-hover/preview:opacity-60 hover:!opacity-100 hover:bg-white/10 transition-all"
			>
				{editing ? (
					<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
						<polyline points="20 6 9 17 4 12" />
					</svg>
				) : (
					<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
						<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
						<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
					</svg>
				)}
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
	const [outputSizes, setOutputSizes]         = useState<Record<number, number>>({})
	// Shared ping-pong progress for all TextPreview cards — one RAF loop for all. (#1)
	const [previewProgress, setPreviewProgress] = useState(0)

	const isLoadingRef        = useRef(false)
	const containerRef        = useRef<HTMLDivElement>(null)
	const warmedUpRef         = useRef(false)
	const styleRef            = useRef<HTMLStyleElement | null>(null)
	const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
	const previewRafRef       = useRef<number>(0)
	const previewStartRef     = useRef<number | null>(null)
	const PREVIEW_DURATION    = 2800

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

	// Single shared RAF loop for all TextPreview cards — avoids N concurrent loops. (#1)
	useEffect(() => {
		previewStartRef.current = null
		function tick(now: number) {
			if (!previewStartRef.current) previewStartRef.current = now
			const t = ((now - previewStartRef.current) % (PREVIEW_DURATION * 2)) / PREVIEW_DURATION
			setPreviewProgress(t <= 1 ? t : 2 - t)
			previewRafRef.current = requestAnimationFrame(tick)
		}
		previewRafRef.current = requestAnimationFrame(tick)
		return () => cancelAnimationFrame(previewRafRef.current)
	}, [])

	// Clear progressIntervalRef on unmount in case the component is removed during processing. (#4)
	useEffect(() => {
		return () => {
			if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
		}
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
		setOutputSizes({})
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
				// Send compact name as the output identifier; VF/static suffix is applied client-side on download
				const name  = group.instances.length === 1 ? first.name : compactName(first.name, last.name)
				return { name, instances: group.instances.map((i) => i.name) }
			})

			// Send as multipart so the font travels as raw binary — no base64 overhead. (#2)
			const fd = new FormData()
			fd.append('font', new Blob([fontBuffer], { type: 'font/ttf' }), 'font')
			fd.append('outputs', JSON.stringify(outputs))
			if (outputFormat !== 'ttf') fd.append('format', outputFormat)

			const res = await fetch('/api/demo/clamp', { method: 'POST', body: fd })
			const json = await res.json()
			if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)

			setProcessingProgress(100)
			setProcessingStage(3)

			const parsedTables: Record<number, Array<{ nameId: number; label: string; value: string }>> = {}
			const newOutputSizes: Record<number, number> = {}
			;(json.results as Array<{ name: string; data: string; format?: string }>).forEach((result, idx) => {
				const group = groups[idx]
				if (!group) return // guard against server returning more results than expected (#5)

				const fmt   = (result.format ?? outputFormat) as OutputFormat
				const bytes = Uint8Array.from(atob(result.data), (c) => c.charCodeAt(0))
				const filename = groupFilename(group, axes, FORMAT_EXT[fmt])

				newOutputSizes[idx] = bytes.byteLength

				const blob = new Blob([bytes], { type: FORMAT_MIME[fmt] })
				const url  = URL.createObjectURL(blob)
				const a    = document.createElement('a')
				a.href = url
				a.download = filename

				// Stagger clicks so Firefox/Safari don't silently drop simultaneous
				// programmatic downloads as popup-blocker violations. (#9)
				setTimeout(() => {
					a.click()
					URL.revokeObjectURL(url)
				}, idx * 150)

				if (fmt === 'ttf' || fmt === 'otf') {
					parsedTables[idx] = parseNameTable(bytes.buffer)
				}
			})
			setNameTables(parsedTables)
			setOutputSizes(newOutputSizes)
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
								{fontBuffer ? ` · ${formatBytes(fontBuffer.byteLength)}` : ''}
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

										const tooltipId = `tip-${inst.name.replace(/\s+/g, '-')}`
										return (
											<div key={inst.name} className="relative">
												<button
													aria-pressed={isSelected}
													aria-describedby={isIsolated ? tooltipId : undefined}
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
													<div
														id={tooltipId}
														role="tooltip"
														className="absolute bottom-full left-0 mb-2 z-10 bg-[#0c1417] border border-amber-400/30 rounded-lg px-3 py-2 text-xs text-amber-300/80 whitespace-nowrap shadow-xl pointer-events-none"
													>
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
						const filename   = groupFilename(group, axes, FORMAT_EXT[outputFormat])
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
									<div className="flex items-center gap-3 flex-wrap">
										<p className="text-[10px] font-mono opacity-25">{filename}</p>
										<p className="text-[10px] font-mono opacity-25">
											{group.instances.length} {group.instances.length === 1 ? 'instance' : 'instances'}
										</p>
										{outputSizes[i] !== undefined && fontBuffer && (
											<p className="text-[10px] font-mono opacity-40">
												{formatBytes(fontBuffer.byteLength)} → {formatBytes(outputSizes[i])}
												{fontBuffer.byteLength > outputSizes[i] && (
													<span className="text-green-400/60 ml-1">
														({Math.round((1 - outputSizes[i] / fontBuffer.byteLength) * 100)}% smaller)
													</span>
												)}
											</p>
										)}
									</div>
								</div>

								{/* Text preview — receives shared progress so all cards share one RAF loop (#1) */}
								{hasDemoFont && (
									<TextPreview axes={axes} axisRanges={group.axisRanges} progress={previewProgress} />
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
								{groups.map((group, i) => (
								<p key={i} className="text-[10px] font-mono opacity-20">
									{groupFilename(group, axes, FORMAT_EXT[outputFormat])}
								</p>
							))}
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
