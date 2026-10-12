# c3 source recovery

PASS: the original c2 archive plus this delta was actually reconstructed into a fresh filesystem tree. Every one of the 2137 c3 input files, and the exact file set, matched the frozen c3 closure by SHA-256. This is source recovery evidence only; it does not assert c3 core, browser, regression, or visual acceptance.

The three unchanged base parts and their hashes are specified by [the c2 archive proof](../../c2/core-archive-proof.json). This folder adds only `delta.tar.gz` (13408 bytes), replacing these two files:

- `src/components/island/growing/authoredCoveLife.test.ts`
- `tools/e2e-authored-cove.mjs`

There are no added or deleted files. [deletions.json](deletions.json) explicitly records the empty deletion list. [inputs.json](inputs.json) is the byte-identical frozen c3 input manifest; [manifest.json](manifest.json) records exact base/delta/target hashes and the reconstruction proof. [execution.log.txt](execution.log.txt) is the raw output of the actual verification.

## Verified procedure

1. Check each of the three original c2 parts against its size and SHA in the c2 proof, then concatenate them in numbered order. The concatenated archive is 106052656 bytes with SHA `7458c6f2f1802a763dda45e5c235597e758bd9a9a138b5f9d2cbb4ab3bee5729`.
2. Extract all regular files into a new temporary tree, rejecting absolute paths, `..`, duplicate entries, symlinks, unexpected files, and missing files. Compare all 2137 extracted c2 files with the c2 closure.
3. Apply the explicit deletion list, then extract the two delta members over that tree. The delta SHA is `b999ba7820860a4a7405d414917b5cf1dc8d32e884fc4511f72c3ab7b332ef7f`.
4. Enumerate and hash the reconstructed tree. Its complete file set and all hashes must equal this folder's `inputs.json`.
5. Recheck all original c2 parts, source proof/closure/snapshot records, and the fixed c3 candidate inputs. They remained unchanged during this run.

The actual temporary reconstruction was `/private/tmp/sansu-authored-cove-c3-source-recovery/reconstructed`. The temporary verification script was `build-recovery.py` in its parent directory. It was run with Python 3 and exited 0; no core/build/browser/regression command was started by this operation. The archive reconstructs the declared input closure, not node_modules, generated outputs, or every file of the full checkout.

`artifact-hashes.json` covers this folder's evidence files and excludes itself to avoid circular hashing. No original c2 evidence or archive part was modified.
