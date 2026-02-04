/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: "#9D84FC", // Darker for better contrast with white text
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
