"""Read-only audit of recorded batches; never submits tasks or changes asset state."""
import argparse
import json
from pathlib import Path
from pipeline import sha, glb_info


def audit(root):
    root = Path(root)
    result = {'scope': 'Recorded batch files, not production adoption or device performance',
              'batches': [], 'assets': [], 'issues': []}
    seen = set()
    for path in sorted((root / 'assets/pipeline').glob('*/state.json')):
        state = json.loads(path.read_text())
        jobs = state['assets']
        consumed = sum(j.get('consumed_credits', 0) for j in jobs.values())
        reserved = sum(j.get('reserved_credits', 0) for j in jobs.values())
        result['batches'].append({'id': state['batch_id'], 'budget': state['budget_credits'],
                                  'reserved': reserved, 'recorded_consumed': consumed})
        if reserved != state['reserved_credits'] or reserved > state['budget_credits']:
            result['issues'].append(f"{state['batch_id']}: inconsistent reservation")
        balance = path.with_name('balance.json')
        if balance.exists():
            b = json.loads(balance.read_text())
            if b['before'] - b['after'] != consumed or b['consumed'] != consumed:
                result['issues'].append(f"{state['batch_id']}: balance mismatch")
        for aid, job in jobs.items():
            if aid in seen:
                result['issues'].append(f'{aid}: duplicate batch ownership')
            seen.add(aid)
            base = root / 'assets' / aid
            row = {'id': aid, 'label': job.get('label', aid), 'status': job['status'], 'files': {}}
            result['assets'].append(row)

            def check(relative, expected):
                file = base / relative
                if not file.exists():
                    result['issues'].append(f'{aid}: missing {relative}')
                    return None
                actual = sha(file)
                row['files'][relative] = {'bytes': file.stat().st_size, 'sha256': actual}
                if not expected or actual != expected:
                    result['issues'].append(f'{aid}: unverified/changed {relative}')
                return file

            check('source/input.png', job.get('source_sha256'))
            for key, relative in [('raw', 'meshy_raw/model.glb'), ('final', 'final/model.glb')]:
                if job['status'] == 'VERIFIED' and key not in job:
                    result['issues'].append(f'{aid}: missing {key} evidence')
                if key in job:
                    file = check(relative, job[key]['sha256'])
                    if file:
                        try:
                            info = glb_info(file)
                            row[key] = {k: info[k] for k in ['bytes', 'triangles', 'materials']}
                        except (ValueError, KeyError) as error:
                            result['issues'].append(f'{aid}: {relative}: {error}')
            if job['status'] == 'VERIFIED':
                verification = base / 'final/verification.json'
                if not verification.exists():
                    result['issues'].append(f'{aid}: missing roundtrip evidence')
                else:
                    v = json.loads(verification.read_text())
                    if not v.get('reimport_pass') or any(v.get(k + '_sha256') != job.get(k, {}).get('sha256') for k in ['raw', 'final']):
                        result['issues'].append(f'{aid}: stale roundtrip evidence')
            review = base / 'final/review.json'
            row['visual_review'] = json.loads(review.read_text()) if review.exists() else 'PENDING'
            profile = base / 'runtime/profile.json'
            if profile.exists():
                p = json.loads(profile.read_text())
                optimized_profile = base / 'optimized/profile-1024.json'
                if not optimized_profile.exists():
                    result['issues'].append(f'{aid}: missing optimization evidence')
                else:
                    op = json.loads(optimized_profile.read_text())
                    if op.get('source_sha256') != job.get('final', {}).get('sha256') or op.get('output_sha256') != p['sourceSha256']:
                        result['issues'].append(f'{aid}: stale optimization chain')
                check('optimized/model-1024.glb', p['sourceSha256'])
                check('runtime/near.glb', p['nearSha256'])
                check('runtime/far-geometry.glb', p['farSha256'])
                row['runtime'] = {k: p[k] for k in ['nearBytes', 'farBytes', 'nearTriangles', 'farTriangles']}
            else:
                row['runtime'] = 'NOT_BUILT'
    result['pass'] = not result['issues']
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', default='.')
    args = parser.parse_args()
    report = audit(args.root)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    raise SystemExit(0 if report['pass'] else 1)
