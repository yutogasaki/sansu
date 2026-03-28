const RELOAD_MARKER_PARAM = '__app-update'

const APP_CACHE_NAME_PATTERNS = [
    'workbox-precache',
    'google-fonts-cache',
    'gstatic-fonts-cache',
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
