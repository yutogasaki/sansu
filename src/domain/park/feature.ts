export const BUILD_PLAY_ENABLED = import.meta.env.VITE_BUILD_PLAY_ENABLED === 'true';
export const BUILD_PLAY_AVAILABLE = BUILD_PLAY_ENABLED || import.meta.env.DEV;
