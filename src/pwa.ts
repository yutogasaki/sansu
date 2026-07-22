import { Workbox } from 'workbox-window'
import { resolveAppAssetPath } from './utils/assets'
import {
    buildReloadUrl,
    isUpdateProtectedHashRoute,
    shouldResetAppCache,
    stripReloadMarker,
} from './pwaUpdateUtils'

const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000
const UPDATE_RECOVERY_DELAY_MS = 4000
const APP_BASE_URL = resolveAppAssetPath('/')
const VERSION_URL = resolveAppAssetPath('/version.json')
const SERVICE_WORKER_URL = resolveAppAssetPath('/sw.js')
const SERVICE_WORKER_SCOPE = APP_BASE_URL

let hasTriggeredReload = false
let hasScheduledRecoveryReload = false
let updateCheckInFlight: Promise<void> | null = null
let deferredReloadVersion: string | null = null
let deferredRecoveryVersion: string | null = null
let hasUserInteracted = false

type AppVersionPayload = {
    version?: string
}

const clearReloadMarkerFromUrl = () => {
    const cleanedUrl = stripReloadMarker(window.location.href)

    if (cleanedUrl === window.location.href) {
        return
    }

    window.history.replaceState(window.history.state, '', cleanedUrl)
}

const isCurrentUpdateProtected = () => isUpdateProtectedHashRoute(
    window.location.hash,
    { allowExploreStartupReload: !hasUserInteracted },
)

const reloadForUpdate = (version = Date.now().toString()) => {
    if (hasTriggeredReload) {
        return
    }

    if (isCurrentUpdateProtected()) {
        deferredReloadVersion = version
        return
    }

    hasTriggeredReload = true
    window.location.replace(buildReloadUrl(window.location.href, version))
}

const shouldCheckForUpdates = () => (
    document.visibilityState === 'visible'
    && navigator.onLine
    && !hasTriggeredReload
)

const checkForServiceWorkerUpdate = async (workbox: Workbox) => {
    if (!shouldCheckForUpdates()) {
        return
    }

    await workbox.update().catch(() => undefined)
}

const checkForAppVersionUpdate = async () => {
    if (!shouldCheckForUpdates()) {
        return
    }

    try {
        const response = await fetch(`${VERSION_URL}?t=${Date.now()}`, {
            cache: 'no-store',
        })

        if (!response.ok) {
            return null
        }

        const data = await response.json() as AppVersionPayload
        if (!data.version || data.version === __APP_VERSION__) {
            return null
        }

        return data.version
    } catch {
        // Ignore transient network errors and retry on the next trigger.
        return null
    }
}

const resetStaleServiceWorkerState = async () => {
    const registration = await navigator.serviceWorker
        .getRegistration(SERVICE_WORKER_SCOPE)
        .catch(() => undefined)

    const cacheNames = 'caches' in window
        ? await caches.keys().catch(() => [] as string[])
        : []

    await Promise.all([
        registration?.unregister().catch(() => false),
        ...cacheNames
            .filter(shouldResetAppCache)
            .map((cacheName) => caches.delete(cacheName).catch(() => false)),
    ])
}

const scheduleRecoveryReload = (version: string) => {
    if (hasScheduledRecoveryReload || deferredRecoveryVersion || hasTriggeredReload) {
        return
    }

    if (isCurrentUpdateProtected()) {
        deferredRecoveryVersion = version
        return
    }

    hasScheduledRecoveryReload = true

    window.setTimeout(() => {
        if (hasTriggeredReload) {
            return
        }

        if (isCurrentUpdateProtected()) {
            hasScheduledRecoveryReload = false
            deferredRecoveryVersion = version
            return
        }

        void resetStaleServiceWorkerState()
            .catch(() => undefined)
            .finally(() => {
                reloadForUpdate(version)
            })
    }, UPDATE_RECOVERY_DELAY_MS)
}

const resumeDeferredUpdate = () => {
    if (hasTriggeredReload || isCurrentUpdateProtected()) {
        return
    }

    if (deferredReloadVersion) {
        const version = deferredReloadVersion
        deferredReloadVersion = null
        deferredRecoveryVersion = null
        reloadForUpdate(version)
        return
    }

    if (deferredRecoveryVersion) {
        const version = deferredRecoveryVersion
        deferredRecoveryVersion = null
        scheduleRecoveryReload(version)
    }
}

const runVersionDriftRecoveryCheck = () => {
    if (updateCheckInFlight || !shouldCheckForUpdates()) {
        return
    }

    updateCheckInFlight = (async () => {
        const nextVersion = await checkForAppVersionUpdate()

        if (!nextVersion || hasTriggeredReload) {
            return
        }

        scheduleRecoveryReload(nextVersion)
    })().finally(() => {
        updateCheckInFlight = null
    })
}

const runUpdateCheck = (workbox: Workbox) => {
    if (updateCheckInFlight || !shouldCheckForUpdates()) {
        return
    }

    updateCheckInFlight = (async () => {
        await checkForServiceWorkerUpdate(workbox)

        if (hasTriggeredReload) {
            return
        }

        const nextVersion = await checkForAppVersionUpdate()

        if (!nextVersion || hasTriggeredReload) {
            return
        }

        scheduleRecoveryReload(nextVersion)
    })().finally(() => {
        updateCheckInFlight = null
    })
}

const attachUpdateCheckTriggers = (triggerUpdateCheck: () => void) => {
    // Home-screen web apps can resume from a cached page snapshot, so we also re-check on pageshow.
    window.setInterval(triggerUpdateCheck, UPDATE_CHECK_INTERVAL_MS)
    window.addEventListener('focus', triggerUpdateCheck)
    window.addEventListener('online', triggerUpdateCheck)
    document.addEventListener('visibilitychange', triggerUpdateCheck)
    window.addEventListener('pageshow', triggerUpdateCheck)

    triggerUpdateCheck()
}

export const registerPWA = () => {
    clearReloadMarkerFromUrl()

    const markUserInteraction = () => {
        hasUserInteracted = true
    }
    window.addEventListener('pointerdown', markUserInteraction, { capture: true, once: true })
    window.addEventListener('keydown', markUserInteraction, { capture: true, once: true })

    if (!import.meta.env.PROD) {
        return
    }

    window.addEventListener('hashchange', resumeDeferredUpdate)

    let triggerUpdateCheck = runVersionDriftRecoveryCheck
    attachUpdateCheckTriggers(() => {
        triggerUpdateCheck()
    })

    if (!('serviceWorker' in navigator)) {
        return
    }

    const workbox = new Workbox(SERVICE_WORKER_URL, {
        scope: SERVICE_WORKER_SCOPE,
        updateViaCache: 'none',
    })

    workbox.addEventListener('waiting', () => {
        workbox.messageSkipWaiting()
    })

    workbox.addEventListener('controlling', (event) => {
        if (!event.isUpdate && !event.isExternal) {
            return
        }

        reloadForUpdate()
    })

    workbox.addEventListener('activated', (event) => {
        if (!event.isUpdate && !event.isExternal) {
            return
        }

        reloadForUpdate()
    })

    void workbox.register({ immediate: true }).then((registration) => {
        if (!registration) {
            return
        }

        triggerUpdateCheck = () => {
            runUpdateCheck(workbox)
        }

        triggerUpdateCheck()
    }).catch((error) => {
        console.error('Failed to register service worker', error)
    })
}
