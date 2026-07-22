# Legacy Ikimono PNG Archive

These 30 PNG files are archived production inputs, not runtime assets.

- Runtime artwork lives under `public/ikimono/*.webp` and is included in the PWA precache.
- `src/components/ikimono/IkimonoArtwork.tsx` provides a code-native SVG fallback while WebP loads or when it fails.
- Do not copy these PNGs back into `public/`; `npm run assets:check` rejects that layout.
