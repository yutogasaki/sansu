export const logInDev = (...args: unknown[]) => {
    if (import.meta.env.DEV) {
        console.log(...args);
    }
};

export const warnInDev = (...args: unknown[]) => {
    if (import.meta.env.DEV) {
        console.warn(...args);
    }
};

export const errorInDev = (...args: unknown[]) => {
    if (import.meta.env.DEV) {
        console.error(...args);
    }
};
