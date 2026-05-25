'use client'
// MagnetText — cursor-proximity per-character font weight variation (MagnetType effect)

import { useRef, useCallback, useEffect } from 'react'

interface MagnetTextProps {
	children: string
	/** CSS className forwarded to the outer span */
	className?: string
	/** Inline styles forwarded to the outer span */
	style?: React.CSSProperties
	/** Minimum wght axis value (at cursor-far distance) */
	minWeight?: number
	/** Maximum wght axis value (at cursor position) */
	maxWeight?: number
	/** Pixel radius at which weight reaches maxWeight */
	radius?: number
	/** Fixed axis values to preserve alongside wght (e.g. { opsz: 144 }) */
	fixedAxes?: Record<string, number>
}

export default function MagnetText({
	children,
	className,
	style,
	minWeight = 300,
	maxWeight = 900,
	radius = 180,
	fixedAxes = {},
}: MagnetTextProps) {
	const spansRef = useRef<(HTMLSpanElement | null)[]>([])

	// Build the fontVariationSettings string given a wght value
	function buildVS(weight: number) {
		const parts = [`'wght' ${weight.toFixed(0)}`]
		for (const [tag, val] of Object.entries(fixedAxes)) {
			parts.push(`'${tag}' ${val}`)
		}
		return parts.join(', ')
	}

	const handleMouseMove = useCallback(
		(e: MouseEvent) => {
			for (const span of spansRef.current) {
				if (!span) continue
				const rect = span.getBoundingClientRect()
				const cx = rect.left + rect.width / 2
				const cy = rect.top + rect.height / 2
				const dist = Math.sqrt((e.clientX - cx) ** 2 + (e.clientY - cy) ** 2)
				const proximity = Math.max(0, 1 - dist / radius)
				const eased = 1 - (1 - proximity) ** 2
				const weight = minWeight + (maxWeight - minWeight) * eased
				span.style.fontVariationSettings = buildVS(weight)
			}
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[minWeight, maxWeight, radius],
	)

	const handleMouseLeave = useCallback(() => {
		for (const span of spansRef.current) {
			if (span) span.style.fontVariationSettings = buildVS(minWeight)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [minWeight])

	useEffect(() => {
		window.addEventListener('mousemove', handleMouseMove, { passive: true })
		document.documentElement.addEventListener('mouseleave', handleMouseLeave)
		return () => {
			window.removeEventListener('mousemove', handleMouseMove)
			document.documentElement.removeEventListener('mouseleave', handleMouseLeave)
		}
	}, [handleMouseMove, handleMouseLeave])

	const chars = children.split('')

	return (
		<span className={className} style={style} aria-label={children}>
			{chars.map((char, i) => (
				<span
					key={i}
					aria-hidden="true"
					ref={(el) => { spansRef.current[i] = el }}
					style={{ display: 'inline', fontVariationSettings: buildVS(minWeight) }}
				>
					{char === ' ' ? ' ' : char}
				</span>
			))}
		</span>
	)
}
