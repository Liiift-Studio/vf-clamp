'use client'
// Client wrapper that applies typsettle's settle animation to a paragraph element
import { SettleText } from '@liiift-studio/typsettle'
import type { ReactNode, CSSProperties } from 'react'

/** Thin client wrapper around SettleText — renders a <p> with the settle animation */
export default function SettleP({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
	return (
		<SettleText className={className} style={style}>
			{children}
		</SettleText>
	)
}
