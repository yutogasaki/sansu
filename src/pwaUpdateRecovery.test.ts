import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchUpdateResource, hasAttemptedUpdateRecovery, recordUpdateRecovery } from './pwaUpdateRecovery'

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('update network requests', () => {
    it('aborts a stalled response body at ten seconds and allows a later retry', async () => {
        vi.useFakeTimers()
        const fetchMock = vi.fn(async (_url: string, options: RequestInit) => ({
            ok: true,
            headers: new Headers({ 'content-type': 'application/json' }),
            text: () => new Promise((_resolve, reject) => {
                options.signal!.addEventListener('abort', () => reject(new Error('aborted')))
            }),
        }))
        vi.stubGlobal('fetch', fetchMock)
        const stalled = fetchUpdateResource('/version.json', 'application/json')
        await vi.advanceTimersByTimeAsync(10000)
        expect(await stalled).toBeNull()
        expect(fetchMock.mock.calls[0][1].signal!.aborted).toBe(true)
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"version":"next"}', {
            headers: { 'content-type': 'application/json' },
        })))
        expect(await fetchUpdateResource('/version.json', 'application/json')).toBe('{"version":"next"}')
        expect(vi.getTimerCount()).toBe(0)
    })

    it('rejects host error pages masquerading as a successful version response', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>not found</html>', {
            headers: { 'content-type': 'text/html' },
        })))
        expect(await fetchUpdateResource('/version.json', 'application/json')).toBeNull()
    })

    it('does not block updates when session storage is unavailable', () => {
        vi.stubGlobal('sessionStorage', {
            getItem: () => { throw new Error('unavailable') },
            setItem: () => { throw new Error('unavailable') },
        })
        expect(() => recordUpdateRecovery('next')).not.toThrow()
        expect(hasAttemptedUpdateRecovery('next')).toBe(false)
    })
})
