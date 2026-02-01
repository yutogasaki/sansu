/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            screens: {
                land: { raw: "(orientation: landscape)" },
                ipadland: { raw: "(min-width: 1024px) and (max-width: 1366px) and (orientation: landscape)" },
            },
        },
    },
    plugins: [],
}
