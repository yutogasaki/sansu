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

interface UpdateProtectedRouteOptions {
    allowExploreStartupReload?: boolean
}

export const isUpdateProtectedHashRoute = (
    hash: string,
    options: UpdateProtectedRouteOptions = {},
) => {
    const hashPath = hash
        .replace(/^#/, '')
        .split(/[?#]/, 1)[0]
        .replace(/\/+$/, '') || '/'

    if (options.allowExploreStartupReload && hashPath === '/explore') {
        return false
    }

    return UPDATE_PROTECTED_HASH_ROUTES.some((route) => (
        hashPath === route || hashPath.startsWith(`${route}/`)
    ))
}
