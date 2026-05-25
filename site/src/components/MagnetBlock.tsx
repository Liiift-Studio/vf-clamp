'use client'
// MagnetBlock — cursor-proximity weight variation for any ReactNode children

import { useRef, useCallback, useEffect } from 'react'

interface MagnetBlockProps {
	children: React.ReactNode
	className?: string
	style?: React.CSSProperties
	minWeight?: number
	maxWeight?: number
	/** Pixel distance from the element edge within which the effect activates */
	proximityRadius?: number
	/** Pixel distance from the cursor within which each word's weight rises to max */
	spreadRadius?: number
	fixedAxes?: Record<string, number>
}

export default function MagnetBlock({
	children, className, style,
	minWeight = 300, maxWeight = 600,
	proximityRadius, spreadRadius,
	fixedAxes = {},
}: MagnetBlockProps) {
	const ref = useRef<HTMLParagraphElement>(null)
	const lastPos = useRef<{ x: number; y: number } | null>(null)
	const wordSpansRef = useRef<HTMLSpanElement[]>([])

	function buildVS(weight: number) {
		const parts = [`'wght' ${weight.toFixed(0)}`]
		for (const [tag, val] of Object.entries(fixedAxes)) parts.push(`'${tag}' ${val}`)
		return parts.join(', ')
	}

	// Post-mount: walk text nodes and wrap each word in a span for per-word proximity
	useEffect(() => {
		if (!spreadRadius) return
		const el = ref.current
		if (!el) return

		const spans: HTMLSpanElement[] = []
		const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
		const textNodes: Text[] = []
		let node: Node | null
		while ((node = walker.nextNode())) textNodes.push(node as Text)

		for (const textNode of textNodes) {
			const text = textNode.textContent ?? ''
			if (!/\S/.test(text)) continue
			const parts = text.split(/(\s+)/)
			const fragment = document.createDocumentFragment()
			for (const part of parts) {
				if (part === '') continue
				if (/^\s+$/.test(part)) {
					fragment.appendChild(document.createTextNode(part))
				} else {
					const span = document.createElement('span')
					span.style.fontVariationSettings = buildVS(minWeight)
					span.textContent = part
					spans.push(span)
					fragment.appendChild(span)
				}
			}
			textNode.parentNode?.replaceChild(fragment, textNode)
		}
		wordSpansRef.current = spans
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	function applyProximity(clientX: number, clientY: number) {
		const el = ref.current
		if (!el) return

		const rect = el.getBoundingClientRect()
		const dx = Math.max(rect.left - clientX, 0, clientX - rect.right)
		const dy = Math.max(rect.top - clientY, 0, clientY - rect.bottom)
		const distToEdge = Math.sqrt(dx * dx + dy * dy)

		// Element-level effect (no per-word spread)
		if (proximityRadius !== undefined && !spreadRadius) {
			const proximity = Math.max(0, 1 - distToEdge / proximityRadius)
			const eased = 1 - (1 - proximity) ** 2
			el.style.fontVariationSettings = buildVS(minWeight + (maxWeight - minWeight) * eased)
			return
		}

		// Per-word spread, with optional proximity gate
		if (spreadRadius) {
			if (proximityRadius !== undefined && distToEdge > proximityRadius) {
				el.style.fontVariationSettings = buildVS(minWeight)
				for (const span of wordSpansRef.current) span.style.fontVariationSettings = buildVS(minWeight)
				return
			}
			for (const span of wordSpansRef.current) {
				const sr = span.getBoundingClientRect()
				const cx = (sr.left + sr.right) / 2
				const cy = (sr.top + sr.bottom) / 2
				const dist = Math.sqrt((clientX - cx) ** 2 + (clientY - cy) ** 2)
				const proximity = Math.max(0, 1 - dist / spreadRadius)
				const eased = 1 - (1 - proximity) ** 2
				span.style.fontVariationSettings = buildVS(minWeight + (maxWeight - minWeight) * eased)
			}
		}
	}

	const handleMouseMove = useCallback((e: MouseEvent) => {
		lastPos.current = { x: e.clientX, y: e.clientY }
		applyProximity(e.clientX, e.clientY)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [minWeight, maxWeight, proximityRadius, spreadRadius])

	const handleScroll = useCallback(() => {
		if (lastPos.current) applyProximity(lastPos.current.x, lastPos.current.y)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [minWeight, maxWeight, proximityRadius, spreadRadius])

	const handleMouseLeave = useCallback(() => {
		lastPos.current = null
		const el = ref.current
		if (el) el.style.fontVariationSettings = buildVS(minWeight)
		for (const span of wordSpansRef.current) span.style.fontVariationSettings = buildVS(minWeight)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [minWeight])

	useEffect(() => {
		window.addEventListener('mousemove', handleMouseMove, { passive: true })
		window.addEventListener('scroll', handleScroll, { passive: true, capture: true })
		document.documentElement.addEventListener('mouseleave', handleMouseLeave)
		return () => {
			window.removeEventListener('mousemove', handleMouseMove)
			window.removeEventListener('scroll', handleScroll, { capture: true })
			document.documentElement.removeEventListener('mouseleave', handleMouseLeave)
		}
	}, [handleMouseMove, handleScroll, handleMouseLeave])

	return (
		<p
			ref={ref}
			className={className}
			style={{ fontVariationSettings: buildVS(minWeight), ...style }}
		>
			{children}
		</p>
	)
}
