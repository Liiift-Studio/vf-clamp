'use client'
// MagnetText — cursor-proximity per-character or per-word font weight variation (MagnetType effect)

import { useRef, useCallback, useEffect } from 'react'

interface MagnetTextProps {
	children: string
	/** CSS className forwarded to the outer span */
	className?: string
	/** Inline styles forwarded to the outer span */
	style?: React.CSSProperties
	/** Minimum wght axis value (cursor far away) */
	minWeight?: number
	/** Maximum wght axis value (cursor on top) */
	maxWeight?: number
	/** Pixel radius over which weight transitions from min to max */
	radius?: number
	/** Fixed axis values to preserve alongside wght (e.g. { opsz: 144 }) */
	fixedAxes?: Record<string, number>
	/** 'char' — per-character effect (display text); 'word' — per-word effect (body text) */
	splitBy?: 'char' | 'word'
	/**
	 * Apply compensating letter-spacing to prevent line-length changes as weight rises.
	 * Measures the element's text width at rest and peak weight via an off-screen probe span,
	 * then applies proportional negative letter-spacing per span as weight rises.
	 * Disable if you prefer natural bold spacing or if your font expands glyphs very unevenly.
	 * @default true
	 */
	stabilizeLayout?: boolean
}

export default function MagnetText({
	children,
	className,
	style,
	minWeight = 300,
	maxWeight = 900,
	radius = 180,
	fixedAxes = {},
	splitBy = 'char',
	stabilizeLayout = true,
}: MagnetTextProps) {
	// Only word spans (not whitespace tokens) are tracked for proximity updates
	const wordSpansRef = useRef<(HTMLSpanElement | null)[]>([])
	const outerRef = useRef<HTMLSpanElement | null>(null)

	// Per-character advance-width delta between minWeight and maxWeight (px)
	const perCharDeltaRef = useRef(0)

	function buildVS(weight: number) {
		const parts = [`'wght' ${weight.toFixed(0)}`]
		for (const [tag, val] of Object.entries(fixedAxes)) {
			parts.push(`'${tag}' ${val}`)
		}
		return parts.join(', ')
	}

	const handleMouseMove = useCallback(
		(e: MouseEvent) => {
			for (const span of wordSpansRef.current) {
				if (!span) continue
				const rect = span.getBoundingClientRect()
				const cx = rect.left + rect.width / 2
				const cy = rect.top + rect.height / 2
				const dist = Math.sqrt((e.clientX - cx) ** 2 + (e.clientY - cy) ** 2)
				const proximity = Math.max(0, 1 - dist / radius)
				const eased = 1 - (1 - proximity) ** 2
				const weight = minWeight + (maxWeight - minWeight) * eased
				span.style.fontVariationSettings = buildVS(weight)
				if (stabilizeLayout && perCharDeltaRef.current !== 0) {
					span.style.letterSpacing = `${(-perCharDeltaRef.current * eased).toFixed(3)}px`
				}
			}
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[minWeight, maxWeight, radius, stabilizeLayout],
	)

	const handleMouseLeave = useCallback(() => {
		for (const span of wordSpansRef.current) {
			if (!span) continue
			span.style.fontVariationSettings = buildVS(minWeight)
			if (stabilizeLayout) span.style.letterSpacing = ''
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [minWeight, stabilizeLayout])

	useEffect(() => {
		window.addEventListener('mousemove', handleMouseMove, { passive: true })
		document.documentElement.addEventListener('mouseleave', handleMouseLeave)
		return () => {
			window.removeEventListener('mousemove', handleMouseMove)
			document.documentElement.removeEventListener('mouseleave', handleMouseLeave)
		}
	}, [handleMouseMove, handleMouseLeave])

	// Measure per-character advance-width delta for layout stabilization.
	// Uses an off-screen probe span so the character spans' inline FVS don't interfere.
	// Re-runs after fonts load to ensure the variable font is active during measurement.
	useEffect(() => {
		if (!stabilizeLayout) {
			perCharDeltaRef.current = 0
			return
		}

		function measure() {
			const el = outerRef.current
			if (!el) return
			const nonSpaceCount = children.replace(/\s/g, '').length
			if (nonSpaceCount === 0) return
			const cs = getComputedStyle(el)
			const probe = document.createElement('span')
			probe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;visibility:hidden;white-space:nowrap;pointer-events:none;'
			probe.style.fontFamily = cs.fontFamily
			probe.style.fontSize = cs.fontSize
			probe.style.fontWeight = cs.fontWeight
			probe.style.lineHeight = cs.lineHeight
			probe.style.letterSpacing = cs.letterSpacing
			probe.textContent = children
			document.body.appendChild(probe)
			probe.style.fontVariationSettings = buildVS(maxWeight)
			const wMax = probe.scrollWidth
			probe.style.fontVariationSettings = buildVS(minWeight)
			const wMin = probe.scrollWidth
			document.body.removeChild(probe)
			perCharDeltaRef.current = wMax > wMin ? (wMax - wMin) / nonSpaceCount : 0
		}

		measure()
		document.fonts?.ready?.then(measure)
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [stabilizeLayout, minWeight, maxWeight, children, JSON.stringify(fixedAxes)])

	// Build token list — words get a ref slot, whitespace is plain text
	type Token = { text: string; isWord: boolean; refIdx?: number }
	const tokens: Token[] = []
	let wordIdx = 0

	if (splitBy === 'word') {
		// Split preserving whitespace runs so we can render them as plain text nodes
		for (const t of children.split(/(\s+)/)) {
			if (!t) continue
			const isWord = /\S/.test(t)
			tokens.push({ text: t, isWord, refIdx: isWord ? wordIdx++ : undefined })
		}
	} else {
		for (const ch of children.split('')) {
			const isWord = ch !== ' '
			tokens.push({ text: ch, isWord, refIdx: isWord ? wordIdx++ : undefined })
		}
	}

	// Keep ref array sized correctly
	wordSpansRef.current = wordSpansRef.current.slice(0, wordIdx)

	return (
		<span ref={outerRef} className={className} style={style} aria-label={children}>
			{tokens.map((token, i) =>
				token.isWord ? (
					<span
						key={i}
						aria-hidden="true"
						ref={(el) => { wordSpansRef.current[token.refIdx!] = el }}
						style={{ display: 'inline', fontVariationSettings: buildVS(minWeight) }}
					>
						{token.text}
					</span>
				) : (
					<span key={i} aria-hidden="true">{token.text}</span>
				),
			)}
		</span>
	)
}
