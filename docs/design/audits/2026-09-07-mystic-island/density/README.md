# Mystic Island dense rendering evidence

Target: local DEV app http://127.0.0.1:5198/#/island at 768×1024. Candidate `mystic-island-three-v1`, delivery `mystic-island-v1`. Synthetic 50-item stress fixture: all positions independently accepted by the current island placement rules. It is not evidence of 50 earned rewards.

- Baseline: 433 steady draw calls. After solid furniture color batching: 169.
- Ordinary correct-answer pulses after static shadow reuse: 170 maximum across 3 pulses.
- Initial full shadow-map upload: 303 calls; recorded separately from ordinary input.
- Correct-answer→next-input: 184.4 / 185.3 / 184.9 ms (diagnostic sample, not throughput parity evidence).
- Software renderer: ANGLE SwiftShader. Pulse render-interval P95: 80–93 ms; does not establish hardware frame rate.
- Six-kind palette screenshot before/after: exactly identical pixels. Dense image comparison: see `pixel-comparison.json`.
- Actual canvas picking selected mushroom `palette-2` and opened its placement controls after batching. Emissive light materials are retained separately; palette pixels include the lamp and fountain.
- Scoped TypeScript, ESLint, and all 8 navigation tests pass after source freeze.
- Final hardware diagnostic confirms actual Apple M4 Metal. Ordinary/dense pulse render-interval P95: 42.6/42.2ms; next-input: 197.3/192.4ms. One warm pulse each, separate from formal throughput repetition. See [hardware.json](hardware.json).

Artifacts: `fixtures.json`, `before.json`, `after.json`, `pixel-comparison.json`, `palette-before.png`, `palette-after.png`, `dense-before.png`, `dense-after.png`, `palette-raycast-after.png`, `dense-learning-after.png`.

This report covers rendering/performance. Synthetic occupancy and author image comparison are not independent child replay/silent-comprehension evidence.
