// site/src/lib/rateLimit.ts — simple per-IP in-memory rate limiter for demo routes
// Resets per function instance — good enough to prevent casual abuse on unauthenticated endpoints.
// Note: x-forwarded-for is taken at face value — spoofing is possible on self-hosted deployments.

const WINDOW_MS = 60_000   // 1 minute window
const MAX_PER_WINDOW = 10  // requests per IP per window

interface Entry { count: number; resetAt: number }
const map = new Map<string, Entry>()

/** Evict expired entries when the map grows large to prevent unbounded memory growth. (#6) */
function evictExpired(): void {
	if (map.size < 1000) return
	const now = Date.now()
	for (const [key, entry] of map) {
		if (now >= entry.resetAt) map.delete(key)
	}
}

/** Returns true if the request should be allowed, false if rate-limited. */
export function checkRateLimit(ip: string): boolean {
	evictExpired()
	const now = Date.now()
	const entry = map.get(ip)
	if (!entry || now >= entry.resetAt) {
		map.set(ip, { count: 1, resetAt: now + WINDOW_MS })
		return true
	}
	if (entry.count >= MAX_PER_WINDOW) return false
	entry.count++
	return true
}

/** Extract the client IP from the x-forwarded-for header (Vercel standard). */
export function getClientIp(req: Request): string {
	const xff = (req as import('next/server').NextRequest).headers.get('x-forwarded-for')
	return xff?.split(',')[0]?.trim() ?? 'unknown'
}
