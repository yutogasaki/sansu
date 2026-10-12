# Shoulder c1 memory diagnostic archive

The original full browser acquisition remains failed by Node OOM. These are bounded pure-Node investigations and a static driver review; they are not replacement acceptance or production performance evidence.

- [Attempt 01](attempt-01/README.md): preserved first raw run; adaptive reserve self-stopped after one baseline frame. No OOM.
- [Attempt 02](attempt-02/README.md): fixed 768 MiB reserve, default Node heap, LRU3 eight states completed then all references released/GC; unbounded four of eight states completed before safety stop. The requested 8-versus-8 comparison is incomplete (12 of 16 total states). Direct placement scans/browser/actor assertions are outside this reduced scope.
- [Static driver review](driver-review.md): live outer-Map removal reviewed without execution. The experiment used two cache layers and had zero cache hits, so hit refresh mismatch and live local retention remain explicit limits.
- [Archive manifest](archive-manifest.json): every copied source file has identical before/after/destination SHA. The 99 immutable c1 projection/source inputs and six installed dependency inputs also remained identical to the c1 core-bound diagnostic inputs. The original failed execution log SHA is retained.

This is a new archive directory. No existing raw evidence, candidate file, or root document was overwritten. No additional browser, build, core, Blender, or heavy test was run while archiving.
