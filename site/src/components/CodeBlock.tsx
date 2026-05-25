'use client'
// Lightweight syntax-highlighted code block with copy-to-clipboard
import { useState } from 'react'
import type { ReactNode } from 'react'

const KEYWORDS = new Set([
	'import', 'export', 'from', 'const', 'let', 'var',
	'function', 'return', 'new', 'default', 'async', 'await',
])

// Captures: (comment) | (string) | (identifier) | (punctuation)
const TOKEN = /(\/\/[^\n]*)|(`[^`]*`|'[^']*'|"[^"]*")|\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b|([\[\]{}()<>=,;./])/g

/** Tokenise code into styled ReactNodes */
function tokenize(code: string): ReactNode[] {
	const nodes: ReactNode[] = []
	let last = 0
	let key = 0
	TOKEN.lastIndex = 0
	let match: RegExpExecArray | null

	while ((match = TOKEN.exec(code)) !== null) {
		if (match.index > last) {
			nodes.push(<span key={key++} style={{ opacity: 0.6 }}>{code.slice(last, match.index)}</span>)
		}

		const [full, comment, str, word, punct] = match

		if (comment) {
			nodes.push(<span key={key++} style={{ opacity: 0.6 }}>{comment}</span>)
		} else if (str) {
			nodes.push(<em key={key++} style={{ fontStyle: 'italic', opacity: 0.6 }}>{str}</em>)
		} else if (word) {
			if (KEYWORDS.has(word)) {
				nodes.push(<strong key={key++} style={{ fontWeight: 600 }}>{word}</strong>)
			} else {
				nodes.push(<span key={key++}>{word}</span>)
			}
		} else if (punct) {
			nodes.push(<span key={key++} style={{ opacity: 0.6 }}>{punct}</span>)
		}

		last = match.index + full.length
	}

	if (last < code.length) {
		nodes.push(<span key={key++} style={{ opacity: 0.6 }}>{code.slice(last)}</span>)
	}

	return nodes
}

/** Renders a syntax-highlighted code snippet with a copy-to-clipboard button */
export default function CodeBlock({ code }: { code: string }) {
	const [copied, setCopied] = useState(false)

	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(code)
			setCopied(true)
			setTimeout(() => setCopied(false), 1800)
		} catch {
			// clipboard API unavailable (non-HTTPS or blocked)
		}
	}

	return (
		<div className="relative group/codeblock">
			<pre className="bg-white/5 rounded p-4 overflow-x-auto text-xs leading-relaxed font-mono">
				<code>{tokenize(code)}</code>
			</pre>
			<button
				onClick={handleCopy}
				aria-label={copied ? 'Copied to clipboard' : 'Copy code to clipboard'}
				className="absolute top-2 right-2 px-2 py-1 rounded text-[10px] font-mono opacity-0 group-hover/codeblock:opacity-40 hover:!opacity-100 transition-all bg-white/5 hover:bg-white/10 border border-white/10"
			>
				{copied ? 'copied ✓' : 'copy'}
			</button>
		</div>
	)
}
