// Anonymous reads from the site all reach the gateway from this server's
// address, so the gateway cannot tell one reader from another. This bucket is
// the only thing in front of them. In memory and per instance: rough, and
// enough until there is a reason for shared state.

const REFILL_PER_SECOND = 5
const CAPACITY = 20
const MAX_KEYS = 10_000

type Bucket = { tokens: number; updatedAt: number }

const buckets = new Map<string, Bucket>()

// Rightmost entry, like the gateway's key resolver: a proxy appends what it
// saw, so the last hop is the one a client cannot write. Everything to its
// left arrived in the request.
export function clientAddress(forwardedFor: string | null): string | null {
    const entries = (forwardedFor ?? '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    return entries.at(-1) ?? null
}

export function takeToken(key: string, now: number = Date.now()): boolean {
    if (buckets.size > MAX_KEYS) sweep(now)

    const bucket = buckets.get(key) ?? { tokens: CAPACITY, updatedAt: now }
    const refilled = ((now - bucket.updatedAt) / 1000) * REFILL_PER_SECOND
    const tokens = Math.min(CAPACITY, bucket.tokens + Math.max(0, refilled))

    if (tokens < 1) {
        buckets.set(key, { tokens, updatedAt: now })
        return false
    }
    buckets.set(key, { tokens: tokens - 1, updatedAt: now })
    return true
}

// Full buckets are indistinguishable from absent ones.
function sweep(now: number) {
    for (const [key, bucket] of buckets) {
        const refilled = ((now - bucket.updatedAt) / 1000) * REFILL_PER_SECOND
        if (bucket.tokens + refilled >= CAPACITY) buckets.delete(key)
    }
}

export function resetBuckets() {
    buckets.clear()
}
