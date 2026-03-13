/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vitejs.dev/config/

const appVersion = process.env.VERCEL_GIT_COMMIT_SHA
    || process.env.GITHUB_SHA
    || process.env.CF_PAGES_COMMIT_SHA
    || new Date().toISOString()

type AssetFile = {
    type: 'asset';
    fileName: string;
    source: string;
}

type BundleContext = {
    emitFile: (file: AssetFile) => void;
}

const appVersionManifestPlugin = () => ({
    name: 'app-version-manifest',
    generateBundle(this: BundleContext) {
        this.emitFile({
            type: 'asset',
            fileName: 'version.json',
            source: JSON.stringify({ version: appVersion }),
        })
    }
})

export default defineConfig({
    define: {
        __APP_VERSION__: JSON.stringify(appVersion),
    },
    plugins: [
        appVersionManifestPlugin(),
        react(),
        VitePWA({
            injectRegister: false,
            registerType: 'autoUpdate',
            includeAssets: ['icons/icon.svg', 'sounds/*.mp3'],
            manifest: false, // We use public/manifest.json
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,mp3,woff,woff2}'],
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'google-fonts-cache',
                            expiration: {
                                maxEntries: 10,
                                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                            },
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    },
                    {
                        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'gstatic-fonts-cache',
                            expiration: {
                                maxEntries: 10,
                                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                            },
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    }
                ]
            }
        })
    ],
    test: {
        environment: "node",
        globals: true
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    react: ["react", "react-dom", "react-router-dom"],
                    motion: ["framer-motion"],
                    charts: ["recharts", "d3-array", "d3-scale", "d3-shape", "d3-time", "d3-interpolate", "d3-color", "d3-ease"],
                    data: ["dexie", "dexie-react-hooks"],
                    pdf: ["pdf-lib", "@pdf-lib/fontkit", "fontkit"],
                    icons: ["react-icons", "lucide-react"],
                    audio: ["howler"]
                }
            }
        }
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
} as any)
