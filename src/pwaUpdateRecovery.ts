const UPDATE_REQUEST_TIMEOUT_MS = 10_000
const RECOVERY_VERSION_KEY = 'sansu-pwa-recovery-version'

export const fetchUpdateResource = async (url: string, contentType: string): Promise<string | null> => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), UPDATE_REQUEST_TIMEOUT_MS)
    try {
        const response = await fetch(url, { cache: 'no-store', signal: controller.signal })
        if (!response.ok || !response.headers.get('content-type')?.includes(contentType)) return null
        // Keep the timeout active while reading the body, too.
        return await response.text()
    } catch {
        return null
    } finally {
        clearTimeout(timeout)
    }
}

export const hasAttemptedUpdateRecovery = (version: string): boolean => {
    try {
        return sessionStorage.getItem(RECOVERY_VERSION_KEY) === version
    } catch {
        return false
    }
}

export const recordUpdateRecovery = (version: string) => {
    try {
        sessionStorage.setItem(RECOVERY_VERSION_KEY, version)
    } catch {
        // Storage restrictions must not block a working update.
    }
}
