import { Workbox } from 'workbox-window'
import { resolveAppAssetPath } from './utils/assets'

const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000
const APP_BASE_URL = resolveAppAssetPath('/')
const VERSION_URL = resolveAppAssetPath('/version.json')
const SERVICE_WORKER_URL = resolveAppAssetPath('/sw.js')
const SERVICE_WORKER_SCOPE = APP_BASE_URL

let hasTriggeredReload = false

type AppVersionPayload = {
    version?: string
}

const shouldCheckForUpdates = () => (
    document.visibilityState === 'visible'
    && navigator.onLine
    && !hasTriggeredReload
)

const checkForServiceWorkerUpdate = (workbox: Workbox) => {
    if (!shouldCheckForUpdates()) {
        return
    }

    void workbox.update().catch(() => undefined)
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
            return
        }

        const data = await response.json() as AppVersionPayload
        if (!data.version || data.version === __APP_VERSION__) {
            return
        }

        hasTriggeredReload = true
        window.location.reload()
    } catch {
        // Ignore transient network errors and retry on the next trigger.
    }
}

const attachServiceWorkerUpdateChecks = (workbox: Workbox) => {
    const triggerUpdateCheck = () => {
        checkForServiceWorkerUpdate(workbox)
        void checkForAppVersionUpdate()
    }

    // Poll for updates so long-lived standalone sessions also pick up new deployments.
    window.setInterval(triggerUpdateCheck, UPDATE_CHECK_INTERVAL_MS)
    window.addEventListener('focus', triggerUpdateCheck)
    window.addEventListener('online', triggerUpdateCheck)
    document.addEventListener('visibilitychange', triggerUpdateCheck)

    triggerUpdateCheck()
}

export const registerPWA = () => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
        return
    }

    const workbox = new Workbox(SERVICE_WORKER_URL, {
        scope: SERVICE_WORKER_SCOPE,
        updateViaCache: 'none',
    })

    workbox.addEventListener('activated', (event) => {
        if (!event.isUpdate && !event.isExternal) {
            return
        }

        if (hasTriggeredReload) {
            return
        }

        hasTriggeredReload = true
        window.location.reload()
    })

    void workbox.register({ immediate: true }).then((registration) => {
        if (!registration) {
            return
        }

        attachServiceWorkerUpdateChecks(workbox)
    }).catch((error) => {
        console.error('Failed to register service worker', error)
    })
}
