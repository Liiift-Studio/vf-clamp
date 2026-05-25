// src/core/utils.ts — shared utility functions

/**
 * Produce a compact display name from the first and last selected instance names.
 * Strips shared leading prefix and trailing suffix tokens, joins differing parts with a dash.
 *
 * Examples:
 *   compactName('Inter Light', 'Inter Bold')         → 'Inter Light-Bold'
 *   compactName('Condensed Thin', 'Condensed Black') → 'Condensed Thin-Black'
 *   compactName('Regular', 'Regular')                → 'Regular'
 *
 * Canonical implementation — also duplicated in the Python plugins and VS Code webview
 * (both sandboxed contexts that cannot import this package at runtime).
 */
export function compactName(first: string, last: string): string {
	if (first === last) return first
	const fw = first.split(' ')
	const lw = last.split(' ')
	let prefixLen = 0
	while (prefixLen < fw.length && prefixLen < lw.length && fw[prefixLen] === lw[prefixLen]) {
		prefixLen++
	}
	let suffixLen = 0
	while (
		suffixLen < fw.length - prefixLen &&
		suffixLen < lw.length - prefixLen &&
		fw[fw.length - 1 - suffixLen] === lw[lw.length - 1 - suffixLen]
	) {
		suffixLen++
	}
	const prefix = fw.slice(0, prefixLen).join(' ')
	const a = fw.slice(prefixLen, fw.length - (suffixLen || 0)).join(' ')
	const b = lw.slice(prefixLen, lw.length - (suffixLen || 0)).join(' ')
	const suffix = suffixLen > 0 ? fw.slice(fw.length - suffixLen).join(' ') : ''
	const middle = a && b ? `${a}-${b}` : a || b
	return [prefix, middle, suffix].filter(Boolean).join(' ')
}
