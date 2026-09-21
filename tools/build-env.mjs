export const withCurrentUiBuildDefaults = (sourceEnv = process.env) => {
    const env = { ...sourceEnv };

    // A plain production build must ship the current Island app. The classic
    // regression path stays available by explicitly setting the flag to false.
    if (env.VITE_ISLAND_ENABLED === undefined) {
        env.VITE_ISLAND_ENABLED = "true";
    }

    return env;
};
