import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const worker = vi.hoisted(() => ({
    listeners: new Map<string, (event: { isUpdate: boolean }) => void>(),
    update: vi.fn(),
    register: vi.fn(),
}))
vi.mock('workbox-window', () => ({ Workbox: class {
    addEventListener(name: string, callback: (event: { isUpdate: boolean }) => void) {
        worker.listeners.set(name, callback)
    }
    update = worker.update
    register = worker.register
    messageSkipWaiting = vi.fn()
} }))

let win: EventTarget & { location: { href: string; hash: string; replace: ReturnType<typeof vi.fn> } }
let doc: EventTarget & { visibilityState: string }
let nav: { onLine: boolean; serviceWorker: { getRegistration: ReturnType<typeof vi.fn> } }
let servedVersion: unknown
let request: ReturnType<typeof vi.fn>
let values: Map<string, string>

beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    vi.stubEnv('PROD', true)
    worker.listeners.clear()
    worker.update.mockReset().mockResolvedValue(undefined)
    worker.register.mockReset().mockResolvedValue({})
    values = new Map()
    win = Object.assign(new EventTarget(), {
        location: { href: 'https://example.com/#/stats', hash: '#/stats', replace: vi.fn() },
        history: { replaceState: vi.fn() },
        setInterval, setTimeout,
    })
    doc = Object.assign(new EventTarget(), { visibilityState: 'visible' })
    nav = { onLine: true, serviceWorker: { getRegistration: vi.fn() } }
    servedVersion = __APP_VERSION__
    request = vi.fn(async (url: string) => url.includes('/version.json')
        ? new Response(JSON.stringify({ version: servedVersion }), { headers: { 'content-type': 'application/json' } })
        : new Response('<html>new app</html>', { headers: { 'content-type': 'text/html' } }))
    vi.stubGlobal('window', win)
    vi.stubGlobal('document', doc)
    vi.stubGlobal('navigator', nav)
    vi.stubGlobal('sessionStorage', {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
    })
    vi.stubGlobal('fetch', request)
    vi.stubGlobal('caches', { delete: vi.fn(), keys: vi.fn() })
})

afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
})

const start = async () => {
    const pwa = await import('./pwa')
    pwa.registerPWA()
    await vi.advanceTimersByTimeAsync(0)
    return pwa
}
const detectUpdate = async () => {
    servedVersion = 'next-build'
    win.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(0)
}

describe('PWA update lifecycle', () => {
    it('checks version drift even when the worker update never resolves', async () => {
        worker.update.mockImplementation(() => new Promise(() => {}))
        await start()
        await detectUpdate()
        await vi.advanceTimersByTimeAsync(4000)
        expect(win.location.replace).toHaveBeenCalledTimes(1)
        expect(win.location.replace).toHaveBeenCalledWith('https://example.com/?__app-update=next-build#/stats')
        expect(request).toHaveBeenCalledWith(expect.stringContaining('__app-update='), expect.objectContaining({ cache: 'no-store' }))
        expect(nav.serviceWorker.getRegistration).not.toHaveBeenCalled()
        expect(caches.delete).not.toHaveBeenCalled()
    })

    it.each(['offline', 'hidden'])('retains recovery when the page becomes %s before the timer fires', async (state) => {
        await start()
        await detectUpdate()
        if (state === 'offline') nav.onLine = false
        else doc.visibilityState = 'hidden'
        await vi.advanceTimersByTimeAsync(4500)
        expect(win.location.replace).not.toHaveBeenCalled()
        expect(caches.delete).not.toHaveBeenCalled()
        nav.onLine = true
        doc.visibilityState = 'visible'
        win.dispatchEvent(new Event('pageshow'))
        await vi.advanceTimersByTimeAsync(4000)
        expect(win.location.replace).toHaveBeenCalledTimes(1)
    })

    it('rechecks critical persistence after awaiting the network preflight', async () => {
        const pwa = await start()
        let deliverHtml!: (response: Response) => void
        const original = request.getMockImplementation()!
        request.mockImplementation((url: string) => url.includes('__app-update=')
            ? new Promise<Response>(resolve => { deliverHtml = resolve }) : original(url))
        await detectUpdate()
        await vi.advanceTimersByTimeAsync(4000)
        const release = pwa.holdPwaUpdateForCriticalPersistence()
        deliverHtml(new Response('<html>new</html>', { headers: { 'content-type': 'text/html' } }))
        await vi.advanceTimersByTimeAsync(0)
        expect(win.location.replace).not.toHaveBeenCalled()
        request.mockImplementation(original)
        release()
        await vi.advanceTimersByTimeAsync(4000)
        expect(win.location.replace).toHaveBeenCalledTimes(1)
    })

    it('retries a failed recovery request on reconnection without removing caches', async () => {
        await start()
        const original = request.getMockImplementation()!
        request.mockImplementation((url: string) => url.includes('__app-update=')
            ? Promise.reject(new Error('network lost')) : original(url))
        await detectUpdate()
        await vi.advanceTimersByTimeAsync(4000)
        expect(win.location.replace).not.toHaveBeenCalled()
        request.mockImplementation(original)
        win.dispatchEvent(new Event('online'))
        await vi.advanceTimersByTimeAsync(4000)
        expect(win.location.replace).toHaveBeenCalledTimes(1)
        expect(caches.delete).not.toHaveBeenCalled()
    })

    it('waits for control, then reloads only once despite multiple lifecycle events', async () => {
        await start()
        worker.listeners.get('activated')?.({ isUpdate: true })
        expect(win.location.replace).not.toHaveBeenCalled()
        worker.listeners.get('controlling')?.({ isUpdate: false })
        expect(win.location.replace).not.toHaveBeenCalled()
        worker.listeners.get('controlling')?.({ isUpdate: true })
        worker.listeners.get('controlling')?.({ isUpdate: true })
        expect(win.location.replace).toHaveBeenCalledTimes(1)
    })

    it('does not repeat a recovery to the same version after reload', async () => {
        values.set('sansu-pwa-recovery-version', 'next-build')
        await start()
        await detectUpdate()
        await vi.advanceTimersByTimeAsync(65000)
        expect(win.location.replace).not.toHaveBeenCalled()
        expect(worker.update).toHaveBeenCalled()
        servedVersion = 'later-build'
        win.dispatchEvent(new Event('focus'))
        await vi.advanceTimersByTimeAsync(4000)
        expect(win.location.replace).toHaveBeenCalledTimes(1)
    })

    it.each([null, 42, {}, '', '   '])('ignores malformed versions: %j', async (version) => {
        servedVersion = version
        await start()
        await vi.advanceTimersByTimeAsync(5000)
        expect(win.location.replace).not.toHaveBeenCalled()
    })
})
