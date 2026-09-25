/// <reference types="vitest" />
import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { loadEnv } from 'vite'
import path from 'path'
import { randomUUID } from 'node:crypto'
import { lifeReplayVersion } from './tools/life-replay-version'

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
    // A redeploy can change flags/assets without changing the Git revision.
    // Generate once per build and share it between the app and version.json.
    const appVersion = `${buildRevision}:${randomUUID()}`
    const park = {
        enabled: false, // Retired: stale deployment flags cannot reactivate the mode.
        renderer: 'retired',
    }
    const island = {
        enabled: env.VITE_ISLAND_ENABLED === 'true',
        delivery: 'mystic-island-v1',
        candidate: 'mystic-island-shore-garden-v18',
        learningCandidate: 'mystic-island-learning-v2',
        residentCandidate: 'patchwork-otter-v1',
        artDirection: ['festival', 'moon-garden', 'prism'].includes(env.VITE_ISLAND_ART_DIRECTION)
            ? env.VITE_ISLAND_ART_DIRECTION : 'moon-garden',
    }
    const visualLineage = deliveryId === 'snap-root-v1'
        ? 'pokko-field-v1'
        : 'legacy-mixed-v0'

    return {
        appVersion,
        replayVersion: lifeReplayVersion(process.cwd(), {
            ...Object.fromEntries(Object.entries(env).filter(([key]) => key.startsWith('VITE_'))),
            MODE: mode, NODE_ENV: process.env.NODE_ENV ?? '',
        }),
        buildRevision,
        deliveryId,
        visualLineage,
        park,
        island,
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
    park,
    island,
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
                park,
                island,
            }),
        })
    }
})

export default defineConfig(({ mode }) => {
    const buildMetadata = resolveBuildMetadata(mode)

    return {
        define: {
            __APP_VERSION__: JSON.stringify(buildMetadata.appVersion),
            __LIFE_REPLAY_VERSION__: JSON.stringify(buildMetadata.replayVersion),
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
                    // The maskable icon files are byte-identical copies. Both
                    // manifest purposes use these two canonical URLs.
                    'icons/icon-192.png',
                    'icons/icon-512.png',
                    'sounds/*.mp3',
                    ikimonoArtworkGlob,
                    exploreArtworkGlob,
                    openingRootPullArtworkGlob,
                ],
                manifest: false, // We use public/manifest.json
                workbox: {
                    skipWaiting: true,
                    clientsClaim: true,
                    // A drift recovery must fetch the new HTML from the host,
                    // even when the currently controlling worker is stale.
                    navigateFallbackDenylist: [/[?&]__app-update=/],
                    // Explicit includeAssets above owns approved offline media;
                    // this glob covers the app shell and the two bundled Life control stills.
                    globPatterns: ['**/*.{js,css,html,ico,woff,woff2}', 'assets/flower-bloom-original-*.png', 'assets/pokomoko-original-*.png', 'assets/town-*.png'],
                    // The public Japanese WOFF2 is not referenced by the app. Keep
                    // the bundled UI font, but do not download this PDF-era copy
                    // during every fresh PWA installation.
                    globIgnores: ['visual-tests/**/*', 'fonts/NotoSansJP-Japanese.woff2'],
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
            globals: true,
            // Immutable verification snapshots are evidence, not a second test suite.
            exclude: [...configDefaults.exclude, 'output/**']
        },
        build: {
            rollupOptions: {
                output: {
                    manualChunks: {
                        react: ["react", "react-dom", "react-router-dom"],
                        motion: ["framer-motion"],
                        // Recharts also imports clsx. Own it separately so the
                        // Island shell does not preload the entire charts chunk.
                        utils: ["clsx"],
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
