from pathlib import Path
import argparse, collections, hashlib, json, re, time

PREP = Path(__file__).resolve().parent
C6_REPORT = Path('/private/tmp/sansu-flower-edge-c6/core/report.json')
COVE = 'docs/design/2026-10-12-authored-cove-entrance'
ROOTS = ('src', 'tools', 'prototypes', 'public')
# App/core/runtime outputs must never enter source identity. Existing authoring
# proofs in the cove source directory are fixed inputs of the current driver.
OUTPUT_SEGMENTS = {'node_modules', 'dist', 'coverage', 'test-results', 'playwright-report', 'output'}
RUNTIME_OUTPUT = re.compile(r'^(?:core|runtime|regressions|runtime-shape|runtime-full|shape-only|browser)(?:-c[0-9]+)?$')
LOCAL = re.compile(r"(?:from\s*|import\s*\(\s*|import\s*)['\"]([^'\"]+)['\"]")
URL = re.compile(r"new\s+URL\(\s*['\"]([^'\"]+)['\"]\s*,\s*import\.meta\.url")
SUFFIXES = ('', '.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '/index.ts', '/index.tsx', '/index.js')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inventory(repo):
    c6 = json.loads(C6_REPORT.read_text())
    assert c6['pass'] and c6['sourceFixed'] and c6['initialInputs'] == c6['finalInputs']
    inherited = set(c6['initialInputs'])
    reasons = collections.defaultdict(set)
    for name in inherited: reasons[name].add('c6 verified closure')
    def output(name):
        parts = Path(name).parts
        # The inherited 32-owner preflight frames are intentional immutable input
        # records; never grow this exception into a broad runtime-output glob.
        return any(part in OUTPUT_SEGMENTS for part in parts) or name.startswith(COVE + '/') and any(RUNTIME_OUTPUT.fullmatch(part) for part in parts[len(Path(COVE).parts):])
    def add(name, reason):
        if output(name): raise RuntimeError('Evidence/output found inside prospective input closure: ' + name)
        reasons[name].add(reason)
    for directory in ROOTS:
        for path in (repo / directory).rglob('*'):
            if path.is_file(): add(path.relative_to(repo).as_posix(), 'full ' + directory + ' source tree')
    source_files = []
    driver_source_files = []
    for path in (repo / COVE).rglob('*'):
        if not path.is_file(): continue
        name = path.relative_to(repo).as_posix()
        if path.suffix in {'.json', '.glb', '.blend'}:
            driver_source_files.append(name)
            add(name, 'cove driver raw/source inputs')
        if path.suffix in {'.py', '.mjs', '.json', '.glb', '.blend'}:
            source_files.append(name)
            add(name, 'cove source construction/provenance')
    # Named runtime source fetches are also covered by the full prototypes tree.
    delivery = json.loads((repo / COVE / 'cove-delivery-manifest.json').read_text())
    add(delivery['artifact']['path'].lstrip('/'), 'cove delivery bytes')
    add(delivery['source']['artifact'], 'cove original shell')
    for name in ('package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.app.json',
                 'docs/design/2026-10-10-island-final-3d/whole-island-render.png',
                 'docs/design/2026-10-10-island-final-3d/whole-island.glb',
                 'docs/design/2026-10-11-authored-whole-preflight/runtime/young-32.frame.json',
                 'docs/design/2026-10-11-authored-whole-preflight/runtime/mature-32.frame.json'):
        add(name, 'explicit cove e2e input')
    scanned = set()
    while True:
        pending = [name for name in reasons if name not in scanned]
        if not pending: break
        for name in pending:
            scanned.add(name)
            path = repo / name
            if not path.is_file(): continue
            if not re.search(r'\.(?:[cm]?[jt]sx?)$', name): continue
            text = path.read_text()
            for match in [*LOCAL.finditer(text), *URL.finditer(text)]:
                specifier = match.group(1).split('?')[0]
                if not specifier.startswith('.'): continue
                resolved = (path.parent / specifier).resolve()
                for suffix in SUFFIXES:
                    candidate = Path(str(resolved) + suffix)
                    if candidate.is_file():
                        try: found = candidate.relative_to(repo).as_posix()
                        except ValueError: raise RuntimeError('Local import escapes candidate: ' + str(candidate))
                        add(found, 'static/dynamic local import from ' + name)
                        break
    missing = sorted(name for name in reasons if not (repo / name).is_file())
    if missing: raise RuntimeError('Missing inherited/source inputs: ' + json.dumps(missing))
    hashes = {name: sha(repo / name) for name in sorted(reasons)}
    changed = [name for name, value in hashes.items() if sha(repo / name) != value]
    if changed: raise RuntimeError('Source changed while preparing closure: ' + json.dumps(changed))
    # Exact current e2e source basis is a strict subset; it uses only place-qa
    # below prototypes, while core intentionally covers the entire tree.
    driver = set(name for name in reasons if name.startswith(('src/', 'tools/', 'prototypes/place-qa/')))
    driver.update(driver_source_files)
    driver.update(name for name in reasons if 'explicit cove e2e input' in reasons[name])
    for name in scanned:
        if any(reason.startswith('static/dynamic local import') for reason in reasons[name]): driver.add(name)
    summary = {
        'mode': 'prospective-source-inventory; not a snapshot or verification result',
        'source': str(repo), 'preparedAt': time.time(), 'c6Report': str(C6_REPORT), 'c6ReportSha256': sha(C6_REPORT),
        'c6InputCount': len(inherited), 'inputCount': len(hashes), 'newInputsCount': len(set(hashes) - inherited),
        'rootCounts': dict(sorted(collections.Counter(name.split('/')[0] for name in hashes).items())),
        'coveSourceCount': len(source_files), 'coveDriverRawSourceCount': len(driver_source_files),
        'conservativeDriverBasisCount': len(driver), 'driverInputsMissingFromCore': sorted(driver - set(hashes)),
        'sourceChangedDuringPreparation': [],
        'inputSetSha256': hashlib.sha256(('\n'.join(hashes) + '\n').encode()).hexdigest(),
        'hashesSha256': hashlib.sha256(json.dumps(hashes, sort_keys=True, separators=(',', ':')).encode()).hexdigest(),
        'excludedFutureEvidence': sorted(OUTPUT_SEGMENTS),
        'newRuntimeEvidenceMustStayOutside': COVE,
    }
    return hashes, {name: sorted(reasons[name]) for name in sorted(reasons)}, summary, sorted(driver)


def main():
    parser = argparse.ArgumentParser(description='Read-only source closure preparation; never runs checks or copies a candidate.')
    parser.add_argument('--repo', default='/Users/yutogasaki/Projects/sansu')
    parser.add_argument('--out', default=str(PREP))
    args = parser.parse_args()
    repo, out = Path(args.repo).resolve(), Path(args.out).resolve()
    if out == repo or repo in out.parents: raise RuntimeError('Preparation output must be outside source tree')
    out.mkdir(parents=True, exist_ok=True)
    hashes, reasons, summary, driver = inventory(repo)
    (out / 'inputs.json').write_text(json.dumps(hashes, indent=2) + '\n')
    (out / 'inputs.txt').write_text('\n'.join(hashes) + '\n')
    (out / 'reasons.json').write_text(json.dumps(reasons, indent=2) + '\n')
    (out / 'driver-inputs.txt').write_text('\n'.join(driver) + '\n')
    (out / 'plan.json').write_text(json.dumps(summary, indent=2) + '\n')
    print(json.dumps(summary, indent=2))

if __name__ == '__main__': main()
