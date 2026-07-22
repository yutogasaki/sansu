import { describe, expect, it } from 'vitest'
import {
    buildReloadUrl,
    createAppUpdateProtectionState,
    enterAppUpdateSession,
    getUpdateProtectedRouteKey,
    isUpdateProtectedHashRoute,
    markAppUpdateInteraction,
    shouldDeferAppUpdate,
    shouldDeferAppUpdateForState,
    shouldResetAppCache,
    stripReloadMarker,
} from './pwaUpdateUtils'

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

    it.each([
        '#/onboarding',
        '#/onboarding?step=3',
        '#/study',
        '#/study?skill=addition',
        '#/explore',
        '#/explore/',
        '#/battle/play?mode=tug_of_war',
    ])('protects an in-memory session on %s', (hash) => {
        expect(isUpdateProtectedHashRoute(hash)).toBe(true)
    })

    it.each([
        ['#/onboarding?step=3', '/onboarding'],
        ['#/study?skill=addition', '/study'],
        ['#/explore/run', '/explore'],
        ['#/battle/play?mode=tug_of_war', '/battle/play'],
    ])('returns a stable session key for %s', (hash, expectedKey) => {
        expect(getUpdateProtectedRouteKey(hash)).toBe(expectedKey)
    })

    it('distinguishes a protected session from a safe route', () => {
        expect(getUpdateProtectedRouteKey('#/study?skill=addition')).toBe('/study')
        expect(getUpdateProtectedRouteKey('#/study?skill=subtraction')).toBe('/study')
        expect(getUpdateProtectedRouteKey('#/battle')).toBeNull()
        expect(getUpdateProtectedRouteKey('#/explore')).not.toBe(
            getUpdateProtectedRouteKey('#/study'),
        )
    })

    it.each([
        '#/onboarding',
        '#/study',
        '#/explore',
        '#/battle/play',
    ])('allows an update before interaction and defers it during %s', (hash) => {
        expect(shouldDeferAppUpdate(hash, false)).toBe(false)
        expect(shouldDeferAppUpdate(hash, true)).toBe(true)
    })

    it('never defers an update on a safe route', () => {
        expect(shouldDeferAppUpdate('#/battle', false)).toBe(false)
        expect(shouldDeferAppUpdate('#/battle', true)).toBe(false)
    })

    it.each([
        '',
        '#/',
        '#/battle',
        '#/stats',
        '#/onboard',
        '#/studying',
        '#/battle/player',
    ])('does not protect ordinary navigation on %s', (hash) => {
        expect(isUpdateProtectedHashRoute(hash)).toBe(false)
    })

    it('protects only after the first interaction in the current protected session', () => {
        const initial = createAppUpdateProtectionState('#/explore', 'router:initial')
        const interacted = markAppUpdateInteraction(initial)

        expect(shouldDeferAppUpdateForState(initial)).toBe(false)
        expect(shouldDeferAppUpdateForState(interacted)).toBe(true)
    })

    it('does not carry protected interaction state onto a safe route', () => {
        const interacted = markAppUpdateInteraction(
            createAppUpdateProtectionState('#/explore', 'router:explore'),
        )
        const safeRoute = enterAppUpdateSession(interacted, '/battle', 'router:hub')

        expect(safeRoute).toEqual({
            routeKey: null,
            sessionKey: 'router:hub',
            hasUserInteracted: false,
        })
        expect(shouldDeferAppUpdateForState(safeRoute)).toBe(false)
    })

    it('re-arms before interaction when navigating between protected routes', () => {
        const interacted = markAppUpdateInteraction(
            createAppUpdateProtectionState('/explore', 'router:explore'),
        )
        const nextRoute = enterAppUpdateSession(interacted, '/study', 'router:study')

        expect(nextRoute).toEqual({
            routeKey: '/study',
            sessionKey: 'router:study',
            hasUserInteracted: false,
        })
        expect(shouldDeferAppUpdateForState(nextRoute)).toBe(false)
    })

    it('re-arms a same-route session when React Router creates a new location key', () => {
        const interacted = markAppUpdateInteraction(
            createAppUpdateProtectionState('/study?session=weak', 'router:first'),
        )
        const nextSession = enterAppUpdateSession(
            interacted,
            '/study?session=periodic-test',
            'router:second',
        )

        expect(nextSession.routeKey).toBe('/study')
        expect(nextSession.sessionKey).toBe('router:second')
        expect(nextSession.hasUserInteracted).toBe(false)
    })

    it('preserves interaction state when the same router location is reported twice', () => {
        const interacted = markAppUpdateInteraction(
            createAppUpdateProtectionState('/battle/play', 'router:same'),
        )

        expect(enterAppUpdateSession(
            interacted,
            '/battle/play?mode=boss_coop',
            'router:same',
        )).toBe(interacted)
    })

    it('re-arms repeated same-route checkpoints when each boundary gets a new key', () => {
        const firstRun = markAppUpdateInteraction(
            createAppUpdateProtectionState('/explore', 'router:explore'),
        )
        const firstSummary = enterAppUpdateSession(
            firstRun,
            '/explore',
            'checkpoint:1:explore-summary',
        )
        const secondRun = markAppUpdateInteraction(firstSummary)
        const secondSummary = enterAppUpdateSession(
            secondRun,
            '/explore',
            'checkpoint:2:explore-summary',
        )

        expect(firstSummary.hasUserInteracted).toBe(false)
        expect(shouldDeferAppUpdateForState(secondRun)).toBe(true)
        expect(secondSummary).toEqual({
            routeKey: '/explore',
            sessionKey: 'checkpoint:2:explore-summary',
            hasUserInteracted: false,
        })
    })
})
