/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { loadEnv } from 'vite'
import path from 'path'

// https://vitejs.dev/config/

const DEFAULT_EXPLORE_DELIVERY_ID = 'snap-root-v1'
const EXPLORE_DELIVERY_IDS = new Set([
    'classic-v1',
    'root-pull-v1',
    'root-pull-v2',
    'snap-root-v1',
])

const resolveBuildMetadata = (mode: string) => {
    const env = loadEnv(mode, process.cwd(), '')
    const buildRevision = env.SANSU_BUILD_REVISION
        || env.VERCEL_GIT_COMMIT_SHA
        || env.GITHUB_SHA
        || env.CF_PAGES_COMMIT_SHA
        || 'development-local'
    const requestedDeliveryId = env.VITE_EXPLORE_EXPERIENCE?.trim()
    const deliveryId = requestedDeliveryId && EXPLORE_DELIVERY_IDS.has(requestedDeliveryId)
        ? requestedDeliveryId
        : DEFAULT_EXPLORE_DELIVERY_ID
    const appVersion = buildRevision === 'development-local'
        ? new Date().toISOString()
        : buildRevision
    const visualLineage = deliveryId === 'snap-root-v1'
        ? 'pokko-field-v1'
        : 'legacy-mixed-v0'

    return {
        appVersion,
        buildRevision,
        deliveryId,
        visualLineage,
    }
}

// Only production-ready assets belong in the offline pack. Drafts and visual
// comparisons live under docs/design (or another production workspace), while
// final encounter scenes use the scene-* contract under public/assets.
const exploreArtworkGlob = 'assets/explore/**/scene-*.{jpg,jpeg,webp,avif}'
const openingRootPullArtworkGlob = 'assets/explore/opening-root-pull-v*/*.{jpg,jpeg,webp,avif}'
const ikimonoArtworkGlob = 'ikimono/*.webp'

type AssetFile = {
    type: 'asset';
    fileName: string;
    source: string;
}

type BundleContext = {
    emitFile: (file: AssetFile) => void;
}

const appVersionManifestPlugin = ({
    appVersion,
    buildRevision,
    deliveryId,
    visualLineage,
}: ReturnType<typeof resolveBuildMetadata>) => ({
    name: 'app-version-manifest',
    generateBundle(this: BundleContext) {
        this.emitFile({
            type: 'asset',
            fileName: 'version.json',
            source: JSON.stringify({
                version: appVersion,
                revision: buildRevision,
                delivery: deliveryId,
                visualLineage,
            }),
        })
    }
})

export default defineConfig(({ mode }) => {
    const buildMetadata = resolveBuildMetadata(mode)

    return {
        define: {
            __APP_VERSION__: JSON.stringify(buildMetadata.appVersion),
            __BUILD_REVISION__: JSON.stringify(buildMetadata.buildRevision),
            __DELIVERY_ID__: JSON.stringify(buildMetadata.deliveryId),
            __VISUAL_LINEAGE_ID__: JSON.stringify(buildMetadata.visualLineage),
        },
        plugins: [
            appVersionManifestPlugin(buildMetadata),
            react(),
            VitePWA({
                injectRegister: false,
                registerType: 'autoUpdate',
                includeAssets: [
                    'icons/*',
                    'sounds/*.mp3',
                    ikimonoArtworkGlob,
                    exploreArtworkGlob,
                    openingRootPullArtworkGlob,
                ],
                manifest: false, // We use public/manifest.json
                workbox: {
                    skipWaiting: true,
                    clientsClaim: true,
                    // Explicit includeAssets above owns approved offline media;
                    // this glob is intentionally limited to the app shell.
                    globPatterns: ['**/*.{js,css,html,ico,woff,woff2}'],
                    globIgnores: ['visual-tests/**/*'],
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
    } as any
})
