import { Workbox } from 'workbox-window'
import { resolveAppAssetPath } from './utils/assets'
import {
    buildReloadUrl,
    createAppUpdateProtectionState,
    enterAppUpdateSession,
    markAppUpdateInteraction,
    shouldDeferAppUpdateForState,
    shouldResetAppCache,
    stripReloadMarker,
} from './pwaUpdateUtils'

const UPDATE_CHECK_INTERVAL_MS = 60 * 1000
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
let updateSessionSequence = 0
let criticalPersistenceCount = 0
let triggerUpdateCheck: () => void = () => undefined
let updateProtectionState = createAppUpdateProtectionState(
    '',
    'bootstrap',
)

type AppVersionPayload = {
    version?: string
}

type PwaE2EWindow = Window & {
    __SANSU_PWA_E2E__?: boolean
}

const clearReloadMarkerFromUrl = () => {
    const cleanedUrl = stripReloadMarker(window.location.href)

    if (cleanedUrl === window.location.href) {
        return
    }

    window.history.replaceState(window.history.state, '', cleanedUrl)
}

const isCurrentUpdateProtected = () => (
    criticalPersistenceCount > 0
    || shouldDeferAppUpdateForState(updateProtectionState)
)

const reloadForUpdate = (version = Date.now().toString()): boolean => {
    if (hasTriggeredReload) {
        return false
    }

    if (isCurrentUpdateProtected()) {
        deferredReloadVersion = version
        return false
    }

    hasTriggeredReload = true
    window.location.replace(buildReloadUrl(window.location.href, version))
    return true
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

const resumeDeferredUpdate = (): boolean => {
    if (hasTriggeredReload || isCurrentUpdateProtected()) {
        return false
    }

    if (deferredReloadVersion) {
        const version = deferredReloadVersion
        deferredReloadVersion = null
        deferredRecoveryVersion = null
        return reloadForUpdate(version)
    }

    if (deferredRecoveryVersion) {
        const version = deferredRecoveryVersion
        deferredRecoveryVersion = null
        scheduleRecoveryReload(version)
        return hasScheduledRecoveryReload
    }

    return false
}

export const holdPwaUpdateForCriticalPersistence = (): (() => void) => {
    criticalPersistenceCount += 1
    let released = false

    return () => {
        if (released) return
        released = true
        criticalPersistenceCount = Math.max(0, criticalPersistenceCount - 1)
        if (criticalPersistenceCount === 0) {
            resumeDeferredUpdate()
        }
    }
}

export const notifyPwaRouteNavigation = (
    routeOrHash: string,
    navigationKey: string,
): boolean => {
    updateProtectionState = enterAppUpdateSession(
        updateProtectionState,
        routeOrHash,
        `router:${navigationKey}`,
    )

    const updateTookOver = resumeDeferredUpdate()
    triggerUpdateCheck()
    return updateTookOver
}

export const reachPwaUpdateCheckpoint = (
    checkpointName: string,
    options: { protectNextSession?: boolean } = {},
): boolean => {
    updateSessionSequence += 1
    updateProtectionState = enterAppUpdateSession(
        updateProtectionState,
        window.location.hash,
        `checkpoint:${updateSessionSequence}:${checkpointName}`,
    )

    const updateTookOver = resumeDeferredUpdate()
    if (updateTookOver || hasScheduledRecoveryReload) {
        return true
    }

    if (options.protectNextSession) {
        // The replay/continue pointer happened before this handler. Carry it
        // into the active session that the same action is about to start.
        updateProtectionState = markAppUpdateInteraction(updateProtectionState)
    }

    return false
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
    updateProtectionState = createAppUpdateProtectionState(
        window.location.hash,
        'bootstrap',
    )

    const markUserInteraction = () => {
        updateProtectionState = markAppUpdateInteraction(updateProtectionState)
    }
    // Keep listening after route changes so every new in-memory session can
    // re-arm update protection after its first interaction.
    window.addEventListener('pointerdown', markUserInteraction, { capture: true })
    window.addEventListener('keydown', markUserInteraction, { capture: true })

    if (!import.meta.env.PROD) {
        return
    }

    if ((window as PwaE2EWindow).__SANSU_PWA_E2E__) {
        let releaseE2ECriticalPersistence: (() => void) | null = null
        window.addEventListener('sansu:pwa-e2e-reload', (event) => {
            const version = (event as CustomEvent<{ version?: string }>).detail?.version
            reloadForUpdate(version || 'pwa-e2e')
        })
        window.addEventListener('sansu:pwa-e2e-recovery', (event) => {
            const version = (event as CustomEvent<{ version?: string }>).detail?.version
            scheduleRecoveryReload(version || 'pwa-e2e-recovery')
        })
        window.addEventListener('sansu:pwa-e2e-persistence', (event) => {
            const active = (event as CustomEvent<{ active?: boolean }>).detail?.active === true
            if (active && !releaseE2ECriticalPersistence) {
                releaseE2ECriticalPersistence = holdPwaUpdateForCriticalPersistence()
                return
            }
            if (!active && releaseE2ECriticalPersistence) {
                const release = releaseE2ECriticalPersistence
                releaseE2ECriticalPersistence = null
                release()
            }
        })
    }

    window.addEventListener('hashchange', () => {
        notifyPwaRouteNavigation(
            window.location.hash,
            `hash:${window.location.hash}`,
        )
    })

    triggerUpdateCheck = runVersionDriftRecoveryCheck
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
