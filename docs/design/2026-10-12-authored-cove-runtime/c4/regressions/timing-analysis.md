# Existing raw timing analysis

These are sums of recorded timed intervals, **not cumulative wall-clock positions**. Captures, setup between timed operations, startup and cleanup are not included. No browser was rerun.

| Operation | Timed seconds | Cumulative timed seconds | Result |
| --- | ---: | ---: | --- |
| load-mature-32 | 21.945 | 21.945 | success |
| select-l31 | 31.395 | 53.340 | success |
| select-l17 | 32.699 | 86.039 | success |
| select-l18 | 31.222 | 117.261 | success |
| select-l19 | 31.710 | 148.971 | success |
| preview-and-cancel-flower | 57.386 | 206.357 | success |
| split-flower | 17.752 | 224.109 | success |
| store-flower | 25.237 | 249.346 | success |
| restore-reconnect-flower | 17.953 | 267.299 | success |
| canvas-select-l31 | 91.670 | 358.969 | success |
| canvas-select-l17 | 72.770 | 431.740 | success |
| canvas-select-l18 | 72.957 | 504.697 | success |
| canvas-select-l19 | 72.178 | 576.874 | success |
| rotate-whole | 39.061 | 615.935 | interrupted |

The four edit intervals total 118.328 s and the four canvas intervals total 309.576 s. All recorded timed intervals sum to 615.935 s versus 900.595 s runner wall duration; the remaining 284.660 s is outside these recorded intervals. Exact per-step wall-clock positions are unavailable. These diagnostics are not product performance acceptance.
