import { describe, expect, it } from 'vitest'

import { createQueue } from './queue'

function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((r) => {
        resolve = r
    })
    return { promise, resolve }
}

describe('createQueue', () => {
    it('runs at most the given number of tasks at once, in order', async () => {
        const enqueue = createQueue(2)
        const started: number[] = []
        const gates = [deferred<void>(), deferred<void>(), deferred<void>()]
        const results = gates.map((gate, index) =>
            enqueue(async () => {
                started.push(index)
                await gate.promise
                return index
            })
        )
        await Promise.resolve()

        expect(started).toEqual([0, 1])

        gates[0].resolve()
        await results[0]
        await Promise.resolve()
        expect(started).toEqual([0, 1, 2])

        gates[1].resolve()
        gates[2].resolve()
        expect(await Promise.all(results)).toEqual([0, 1, 2])
    })

    it('frees the slot when a task throws', async () => {
        const enqueue = createQueue(1)
        await expect(enqueue(async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom')
        expect(await enqueue(async () => 'next')).toBe('next')
    })
})
