import type { Metadata } from "next"
import localFont from "next/font/local"
import "./globals.css"

// Use the self-hosted inter-300.woff already present in public/fonts/ — avoids a
// Google Fonts network round-trip and matches the weight actually used (300).
const inter = localFont({
	src: "../../public/fonts/inter-300.woff",
	weight: "300",
	variable: "--font-inter",
	display: "swap",
})

export const metadata: Metadata = {
	title: "vf-clamp — Restrict variable font axis ranges | Type Tools",
	icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
	description: "Deliver a variable font scoped to the instances a customer bought. Restrict axes, pin values, rewrite the name table, download scoped VFs. Powered by fonttools via Pyodide WASM.",
	keywords: ["variable font", "vf-clamp", "font instancer", "axis range", "named instances", "typography", "npm", "fonttools", "pyodide", "wasm", "woff2", "design space", "font subsetting", "micro-vf", "font licensing", "per-instance licensing", "font delivery", "foundry tools", "type foundry", "liiift"],
	openGraph: {
		title: "vf-clamp — Restrict variable font axis ranges | Type Tools",
		description: "Restrict a variable font's design space to a named-instance range. Pin axes, clamp to sub-ranges, and download scoped VFs — powered by fonttools via Pyodide WASM.",
		url: "https://vfclamp.com",
		siteName: "vf-clamp",
		type: "website",
		images: [{ url: "/opengraph-image", width: 1200, height: 630, type: "image/png" }],
	},
	twitter: {
		card: "summary_large_image",
		title: "vf-clamp — Restrict variable font axis ranges | Type Tools",
		description: "Restrict a variable font's design space to a named-instance range. Pin axes, clamp to sub-ranges, download scoped VFs — no Python required.",
	},
	metadataBase: new URL("https://vfclamp.com"),
	alternates: { canonical: "https://vfclamp.com" },
}

/** JSON-LD structured data — SoftwareApplication schema for rich-result eligibility. */
const jsonLd = {
	'@context': 'https://schema.org',
	'@type': 'SoftwareApplication',
	name: 'vf-clamp',
	url: 'https://vfclamp.com',
	description: 'Restrict a variable font\'s design space to a named-instance range. Pin axes, clamp to sub-ranges, and download scoped VFs.',
	applicationCategory: 'DeveloperApplication',
	operatingSystem: 'Node.js',
	offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en" className={`h-full antialiased ${inter.variable}`}>
			<head>
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
				/>
			</head>
			<body className="min-h-full flex flex-col">{children}</body>
		</html>
	)
}
