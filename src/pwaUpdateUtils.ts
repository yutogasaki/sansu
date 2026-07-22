const RELOAD_MARKER_PARAM = '__app-update'

const APP_CACHE_NAME_PATTERNS = [
    'workbox-precache',
    'google-fonts-cache',
    'gstatic-fonts-cache',
]

const UPDATE_PROTECTED_HASH_ROUTES = [
    '/onboarding',
    '/study',
    '/explore',
    '/battle/play',
]

const normalizeHashPath = (hash: string) => (
    hash
        .replace(/^#/, '')
        .split(/[?#]/, 1)[0]
        .replace(/\/+$/, '') || '/'
)

export const buildReloadUrl = (currentUrl: string, version: string) => {
    const url = new URL(currentUrl)
    url.searchParams.set(RELOAD_MARKER_PARAM, version)
    return url.toString()
}

export const stripReloadMarker = (currentUrl: string) => {
    const url = new URL(currentUrl)
    url.searchParams.delete(RELOAD_MARKER_PARAM)
    return url.toString()
}

export const shouldResetAppCache = (cacheName: string) => (
    APP_CACHE_NAME_PATTERNS.some((pattern) => cacheName.includes(pattern))
)

export const getUpdateProtectedRouteKey = (hash: string) => {
    const hashPath = normalizeHashPath(hash)

    return UPDATE_PROTECTED_HASH_ROUTES.find((route) => (
        hashPath === route || hashPath.startsWith(`${route}/`)
    )) ?? null
}

export const isUpdateProtectedHashRoute = (hash: string) => (
    getUpdateProtectedRouteKey(hash) !== null
)

export const shouldDeferAppUpdate = (hash: string, hasUserInteracted: boolean) => (
    hasUserInteracted && isUpdateProtectedHashRoute(hash)
)

export type AppUpdateProtectionState = Readonly<{
    routeKey: string | null
    sessionKey: string
    hasUserInteracted: boolean
}>

export const createAppUpdateProtectionState = (
    routeOrHash: string,
    sessionKey: string,
): AppUpdateProtectionState => ({
    routeKey: getUpdateProtectedRouteKey(routeOrHash),
    sessionKey,
    hasUserInteracted: false,
})

export const enterAppUpdateSession = (
    state: AppUpdateProtectionState,
    routeOrHash: string,
    sessionKey: string,
): AppUpdateProtectionState => {
    const routeKey = getUpdateProtectedRouteKey(routeOrHash)

    if (routeKey === state.routeKey && sessionKey === state.sessionKey) {
        return state
    }

    return {
        routeKey,
        sessionKey,
        hasUserInteracted: false,
    }
}

export const markAppUpdateInteraction = (
    state: AppUpdateProtectionState,
): AppUpdateProtectionState => {
    if (state.routeKey === null || state.hasUserInteracted) {
        return state
    }

    return {
        ...state,
        hasUserInteracted: true,
    }
}

export const shouldDeferAppUpdateForState = (
    state: AppUpdateProtectionState,
) => state.routeKey !== null && state.hasUserInteracted
