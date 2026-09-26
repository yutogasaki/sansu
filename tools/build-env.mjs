export const withCurrentUiBuildDefaults = (sourceEnv = process.env) => {
    const env = { ...sourceEnv };

    // A plain production build must ship the current Island Life app. The
    // classic/regression paths stay available by explicitly setting flags to
    // false, but local preview must not silently boot the heavy legacy stage.
    if (env.VITE_ISLAND_ENABLED === undefined) {
        env.VITE_ISLAND_ENABLED = "true";
    }
    if (env.VITE_ISLAND_LIFE_ENABLED === undefined) {
        env.VITE_ISLAND_LIFE_ENABLED = "true";
    }

    return env;
};
