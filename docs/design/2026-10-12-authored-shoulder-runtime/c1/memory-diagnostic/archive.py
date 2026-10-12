import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

source = Path(__file__).parent
destination = Path('/private/tmp/sansu-authored-shoulder-c1/memory-diagnostic')
assert not destination.exists(), 'Fresh archive only; never overwrite evidence'
sha = lambda file: hashlib.sha256(file.read_bytes()).hexdigest()
mapping = {}
for file in sorted(source.iterdir()):
    if file.is_file():
        target = file.name if file.name.startswith('driver-review') or file.name == 'archive.py' else f'attempt-01/{file.name}'
        mapping[file.relative_to(source).as_posix()] = target
for file in sorted((source / 'attempt-02').rglob('*')):
    if file.is_file():
        mapping[file.relative_to(source).as_posix()] = file.relative_to(source).as_posix()
before = {file: sha(source / file) for file in mapping}
report = json.loads((source / 'attempt-02/report.json').read_text())
candidate = Path(report['candidate'])
input_before = {file: sha(candidate / file) for file in report['initialInputs']}
dependency_before = {file: sha(candidate / file) for file in report['initialInstalledDependencies']}
assert input_before == report['initialInputs'] == report['finalInputs']
assert dependency_before == report['initialInstalledDependencies'] == report['finalInstalledDependencies']
assert sha(Path(report['rawFailure']['path'])) == report['rawFailure']['sha256']
destination.mkdir()
for file, target in mapping.items():
    output = destination / target
    output.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source / file, output)
after = {file: sha(source / file) for file in mapping}
copied = {file: sha(destination / target) for file, target in mapping.items()}
assert before == after == copied
input_after = {file: sha(candidate / file) for file in report['initialInputs']}
dependency_after = {file: sha(candidate / file) for file in report['initialInstalledDependencies']}
assert input_before == input_after
assert dependency_before == dependency_after
manifest = {
    'createdAt': datetime.now(timezone.utc).isoformat(),
    'sourceDirectory': str(source), 'destinationDirectory': str(destination),
    'sourceBefore': before, 'sourceAfter': after, 'destinationHashesBySourcePath': copied,
    'mapping': mapping, 'sourceAndDestinationMatch': True,
    'candidateInputBefore': input_before, 'candidateInputAfter': input_after,
    'installedDependencyBefore': dependency_before, 'installedDependencyAfter': dependency_after,
    'candidateInputsUnchanged': True, 'installedDependenciesUnchanged': True,
    'rawFailure': report['rawFailure'],
}
(destination / 'archive-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
(destination / 'README.md').write_text('''# Shoulder c1 memory diagnostic archive

The original full browser acquisition remains failed by Node OOM. These are bounded pure-Node investigations and a static driver review; they are not replacement acceptance or production performance evidence.

- [Attempt 01](attempt-01/README.md): preserved first raw run; adaptive reserve self-stopped after one baseline frame. No OOM.
- [Attempt 02](attempt-02/README.md): fixed 768 MiB reserve, default Node heap, LRU3 eight states completed then all references released/GC; unbounded four of eight states completed before safety stop. The requested 8-versus-8 comparison is incomplete (12 of 16 total states). Direct placement scans/browser/actor assertions are outside this reduced scope.
- [Static driver review](driver-review.md): live outer-Map removal reviewed without execution. The experiment used two cache layers and had zero cache hits, so hit refresh mismatch and live local retention remain explicit limits.
- [Archive manifest](archive-manifest.json): every copied source file has identical before/after/destination SHA. The 99 immutable c1 projection/source inputs and six installed dependency inputs also remained identical to the c1 core-bound diagnostic inputs. The original failed execution log SHA is retained.

This is a new archive directory. No existing raw evidence, candidate file, or root document was overwritten. No additional browser, build, core, Blender, or heavy test was run while archiving.
''')
print(json.dumps({'destination': str(destination), 'copiedFiles': len(mapping),
                  'sourceAndDestinationMatch': True, 'inputsUnchanged': True,
                  'archiveManifestSha256': sha(destination / 'archive-manifest.json')}))
