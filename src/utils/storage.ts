/**
 * Centralized localStorage management
 * All localStorage operations should go through this module
 */

// ============================================================
// Storage Keys (centralized)
// ============================================================

const STORAGE_KEYS = {
    // Active profile
    ACTIVE_PROFILE_ID: 'sansu_active_profile_id',

    // Event tracking
    EVENT_LAST_SHOWN: 'sansu_event_last_shown',
    EVENT_SHOWN_DATE: 'sansu_event_shown_date',
    EVENT_CHECK_PENDING: 'sansu_event_check_pending',

    // Weak points tracking
    PREV_WEAK_COUNT: 'sansu_prev_weak_count',

    // Settings
    SOUND_ENABLED: 'sansu_sound_enabled',

    // Debug/Dev
    DEBUG_MODE: 'sansu_debug_mode',

    // Ikimono
    IKIMONO_STATE: 'sansu_ikimono_state',
} as const;

type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

// ============================================================
// Core Storage Operations
// ============================================================

/**
 * Get a value from localStorage with type safety
 */
const get = <T>(key: StorageKey, defaultValue: T): T => {
    try {
        const item = localStorage.getItem(key);
        if (item === null) return defaultValue;
        return JSON.parse(item) as T;
    } catch {
        return defaultValue;
    }
};

/**
 * Get a raw string value
 */
const getString = (key: StorageKey): string | null => {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
};

/**
 * Set a value in localStorage
 */
const set = <T>(key: StorageKey, value: T): void => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error(`[Storage] Failed to set ${key}:`, error);
    }
};

/**
 * Set a raw string value
 */
const setString = (key: StorageKey, value: string): void => {
    try {
        localStorage.setItem(key, value);
    } catch (error) {
        console.error(`[Storage] Failed to set ${key}:`, error);
    }
};

/**
 * Remove a value from localStorage
 */
const remove = (key: StorageKey): void => {
    try {
        localStorage.removeItem(key);
    } catch (error) {
        console.error(`[Storage] Failed to remove ${key}:`, error);
    }
};

/**
 * Clear all app-specific localStorage
 */
const clearAll = (): void => {
    Object.values(STORAGE_KEYS).forEach(key => {
        try {
            localStorage.removeItem(key);
        } catch {
            // Ignore
        }
    });
};

// ============================================================
// Domain-Specific Accessors
// ============================================================

/**
 * Active profile management
 */
export const profileStorage = {
    getActiveId: (): string | null => getString(STORAGE_KEYS.ACTIVE_PROFILE_ID),
    setActiveId: (id: string): void => setString(STORAGE_KEYS.ACTIVE_PROFILE_ID, id),
    clearActiveId: (): void => remove(STORAGE_KEYS.ACTIVE_PROFILE_ID),
};

/**
 * Event tracking
 */
export const eventStorage = {
    getLastShownEvent: (): string | null => getString(STORAGE_KEYS.EVENT_LAST_SHOWN),
    getLastShownDate: (): string | null => getString(STORAGE_KEYS.EVENT_SHOWN_DATE),
    isPending: (): boolean => getString(STORAGE_KEYS.EVENT_CHECK_PENDING) === '1',

    setShown: (eventType: string, date: string): void => {
        setString(STORAGE_KEYS.EVENT_LAST_SHOWN, eventType);
        setString(STORAGE_KEYS.EVENT_SHOWN_DATE, date);
    },

    setPending: (pending: boolean): void => {
        if (pending) {
            setString(STORAGE_KEYS.EVENT_CHECK_PENDING, '1');
        } else {
            remove(STORAGE_KEYS.EVENT_CHECK_PENDING);
        }
    },

    clearPending: (): void => remove(STORAGE_KEYS.EVENT_CHECK_PENDING),
};

/**
 * Weak points tracking
 */
export const weakPointsStorage = {
    getPrevCount: (): number | undefined => {
        const val = getString(STORAGE_KEYS.PREV_WEAK_COUNT);
        return val !== null ? parseInt(val, 10) : undefined;
    },
    setPrevCount: (count: number): void => setString(STORAGE_KEYS.PREV_WEAK_COUNT, count.toString()),
};

/**
 * Sound settings
 */
export const soundStorage = {
    isEnabled: (): boolean => get(STORAGE_KEYS.SOUND_ENABLED, true),
    setEnabled: (enabled: boolean): void => set(STORAGE_KEYS.SOUND_ENABLED, enabled),
};

/**
 * Ikimono state
 */
export const ikimonoStorage = {
    getState: (): { profileId: string; birthDate: string; generation: number } | null =>
        get(STORAGE_KEYS.IKIMONO_STATE, null),
    setState: (state: { profileId: string; birthDate: string; generation: number }): void =>
        set(STORAGE_KEYS.IKIMONO_STATE, state),
    clear: (): void => remove(STORAGE_KEYS.IKIMONO_STATE),
};

/**
 * Debug settings
 */
export const debugStorage = {
    isEnabled: (): boolean => get(STORAGE_KEYS.DEBUG_MODE, false),
    setEnabled: (enabled: boolean): void => set(STORAGE_KEYS.DEBUG_MODE, enabled),
};

// ============================================================
// Export Everything
// ============================================================

export const storage = {
    keys: STORAGE_KEYS,
    get,
    getString,
    set,
    setString,
    remove,
    clearAll,

    // Domain-specific
    profile: profileStorage,
    event: eventStorage,
    weakPoints: weakPointsStorage,
    sound: soundStorage,
    ikimono: ikimonoStorage,
    debug: debugStorage,
};

export default storage;
