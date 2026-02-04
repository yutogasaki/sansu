/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: "#483D8B", // Much Darker (DarkSlateBlue) for distinct visibility
                background: "#F8F9FB",
                surface: "#FFFFFF",
                text: {
                    main: "#2D3436",
                    sub: "#636E72",
                },
            },
            borderRadius: {
                'xl': '1.5rem',
                '2xl': '2.0rem',
                '3xl': '3.0rem',
            },
            screens: {
                mobile: { max: "480px" },
                land: { raw: "(orientation: landscape)" },
                ipadland: { raw: "(min-width: 768px) and (max-width: 1366px) and (orientation: landscape)" },
            },
        },
    },
    plugins: [],
}
