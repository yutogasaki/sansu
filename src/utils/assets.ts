export const resolveAppAssetPath = (path: string) => (
    `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`
);
