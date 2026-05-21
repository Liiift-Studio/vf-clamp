import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
	title: 'vf-clamp — Restrict variable font axis ranges',
	description: 'Clamp a variable font\'s design space to specific axis ranges. Like CSS clamp() for type. npm install vf-clamp.',
	keywords: ['variable font', 'vf-clamp', 'font instancer', 'axis range', 'typography', 'npm', 'fonttools'],
	authors: [{ name: 'Liiift Studio', url: 'https://liiift.studio' }],
	openGraph: {
		title: 'vf-clamp — Restrict variable font axis ranges',
		description: 'Clamp a variable font\'s design space to specific axis ranges. Like CSS clamp() for type.',
		url: 'https://vfclamp.com',
		siteName: 'vf-clamp',
		type: 'website',
	},
	twitter: {
		card: 'summary_large_image',
		title: 'vf-clamp — Restrict variable font axis ranges',
		description: 'Clamp a variable font\'s design space to specific axis ranges. Like CSS clamp() for type.',
	},
	metadataBase: new URL('https://vfclamp.com'),
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en" className={`h-full antialiased ${inter.variable}`}>
			<body className="min-h-full flex flex-col font-[var(--font-sans)]">{children}</body>
		</html>
	)
}
