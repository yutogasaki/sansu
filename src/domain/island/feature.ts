export const ISLAND_DELIVERY_ID = 'mystic-island-v1';
export const ISLAND_VISUAL_CANDIDATE = 'mystic-island-shore-garden-v7';
export const ISLAND_LEARNING_CANDIDATE = 'mystic-island-learning-v2';

export function islandEnabled(): boolean {
    return import.meta.env.VITE_ISLAND_ENABLED === 'true';
}

export function islandAvailable(): boolean {
    return islandEnabled() || import.meta.env.DEV;
}
