import { describe, expect, it } from 'vitest'
import { buildReloadUrl, shouldResetAppCache, stripReloadMarker } from './pwaUpdateUtils'

describe('pwaUpdateUtils', () => {
    it('adds a stable update marker without dropping existing query params or hashes', () => {
        const url = buildReloadUrl(
            'https://example.com/study?mode=math#question-3',
            'build-123',
        )

        expect(url).toBe('https://example.com/study?mode=math&__app-update=build-123#question-3')
    })

    it('removes only the update marker from a URL', () => {
        const url = stripReloadMarker(
            'https://example.com/study?mode=math&__app-update=build-123#question-3',
        )

        expect(url).toBe('https://example.com/study?mode=math#question-3')
    })

    it('matches only app-managed cache names for reset', () => {
        expect(shouldResetAppCache('workbox-precache-v2')).toBe(true)
        expect(shouldResetAppCache('google-fonts-cache')).toBe(true)
        expect(shouldResetAppCache('gstatic-fonts-cache')).toBe(true)
        expect(shouldResetAppCache('user-generated-assets')).toBe(false)
    })
})
