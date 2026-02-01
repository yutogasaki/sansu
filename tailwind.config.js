/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            screens: {
                mobile: { max: "480px" },
                land: { raw: "(orientation: landscape)" },
                ipadland: { raw: "(min-width: 768px) and (max-width: 1366px) and (orientation: landscape)" },
            },
        },
    },
    plugins: [],
}
