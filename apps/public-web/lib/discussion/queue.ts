// Reads leave two at a time, in the order they were asked. Both limits on the way (the proxy's
// per-address 5/s with a burst of 20 for anonymous readers, the gateway's per-reader one for
// the rest) are easy to spend with a column of "show replies" clicked in a row, and a queue is
// cheaper than teaching every caller about 429.
export function createQueue(concurrency: number) {
    let running = 0
    const waiting: Array<() => void> = []

    return async function enqueue<T>(task: () => Promise<T>): Promise<T> {
        if (running >= concurrency) {
            await new Promise<void>((resolve) => waiting.push(resolve))
        }
        running += 1
        try {
            return await task()
        } finally {
            running -= 1
            waiting.shift()?.()
        }
    }
}

export const readQueue = createQueue(2)
