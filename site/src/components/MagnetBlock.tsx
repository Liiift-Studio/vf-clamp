'use client'
// MagnetBlock — cursor-proximity weight variation applied to the whole element (works with any ReactNode)

import { useRef, useCallback, useEffect } from 'react'

interface MagnetBlockProps {
	children: React.ReactNode
	className?: string
	style?: React.CSSProperties
	minWeight?: number
	maxWeight?: number
	/** Pixel radius beyond the element edge over which weight fades from max to min */
	radius?: number
	fixedAxes?: Record<string, number>
}

export default function MagnetBlock({
	children, className, style,
	minWeight = 300, maxWeight = 600, radius = 180,
	fixedAxes = {},
}: MagnetBlockProps) {
	const ref = useRef<HTMLParagraphElement>(null)
	const lastPos = useRef<{ x: number; y: number } | null>(null)

	function buildVS(weight: number) {
		const parts = [`'wght' ${weight.toFixed(0)}`]
		for (const [tag, val] of Object.entries(fixedAxes)) parts.push(`'${tag}' ${val}`)
		return parts.join(', ')
	}

	function applyProximity(clientX: number, clientY: number) {
		const el = ref.current
		if (!el) return
		const rect = el.getBoundingClientRect()
		const dx = Math.max(rect.left - clientX, 0, clientX - rect.right)
		const dy = Math.max(rect.top - clientY, 0, clientY - rect.bottom)
		const dist = Math.sqrt(dx * dx + dy * dy)
		const proximity = Math.max(0, 1 - dist / radius)
		const eased = 1 - (1 - proximity) ** 2
		const weight = minWeight + (maxWeight - minWeight) * eased
		el.style.fontVariationSettings = buildVS(weight)
	}

	const handleMouseMove = useCallback((e: MouseEvent) => {
		lastPos.current = { x: e.clientX, y: e.clientY }
		applyProximity(e.clientX, e.clientY)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [minWeight, maxWeight, radius])

	const handleScroll = useCallback(() => {
		if (lastPos.current) applyProximity(lastPos.current.x, lastPos.current.y)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [minWeight, maxWeight, radius])

	const handleMouseLeave = useCallback(() => {
		lastPos.current = null
		const el = ref.current
		if (el) el.style.fontVariationSettings = buildVS(minWeight)
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
