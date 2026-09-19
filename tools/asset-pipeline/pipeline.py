#!/usr/bin/env python3
"""Local state/guardrails for an agent-driven Meshy MCP → Blender pipeline.

No network or paid API calls. reserve prints the ONE authorized MCP request.
Never repeat that request after an uncertain result; recover its task ID instead.
"""
import argparse
import contextlib
import datetime
import fcntl
import hashlib
import json
import math
import os
from pathlib import Path
import re
import struct
import tempfile


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(dir=path.parent, prefix='.state-')
    try:
        with os.fdopen(fd, 'w') as stream:
            json.dump(value, stream, ensure_ascii=False, indent=2)
            stream.write('\n')
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, path)
        directory_fd = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def glb_info(path):
    data = Path(path).read_bytes()
    if len(data) < 28:
        raise ValueError('Truncated GLB')
    magic, version, size = struct.unpack_from('<III', data)
    if (magic, version, size) != (0x46546C67, 2, len(data)):
        raise ValueError('Invalid GLB header')
    length, kind = struct.unpack_from('<II', data, 12)
    if kind != 0x4E4F534A:
        raise ValueError('Missing JSON chunk')
    doc = json.loads(data[20:20 + length])
    accessors = doc['accessors']
    primitives = [p for m in doc['meshes'] for p in m['primitives']]
    if any(p.get('mode', 4) != 4 for p in primitives):
        raise ValueError('Expected triangle primitives')
    triangles = sum(accessors[p['indices']]['count'] // 3 for p in primitives)
    images = doc.get('images', [])
    if not images or any('uri' in i or 'bufferView' not in i for i in images):
        raise ValueError('Textures must be embedded')
    image_hashes = []
    bin_start = 20 + length + 8
    for image in images:
        view = doc['bufferViews'][image['bufferView']]
        start = bin_start + view.get('byteOffset', 0)
        image_hashes.append(hashlib.sha256(data[start:start + view['byteLength']]).hexdigest())
    for material in doc['materials']:
        pbr = material.get('pbrMetallicRoughness', {})
        if not all(k in pbr for k in ['baseColorTexture', 'metallicRoughnessTexture']) or 'normalTexture' not in material:
            raise ValueError('Missing required PBR maps')
    return {'bytes': size, 'sha256': sha(path), 'triangles': triangles,
            'meshes': len(doc['meshes']), 'nodes': len(doc.get('nodes', [])),
            'materials': len(doc['materials']), 'image_hashes': sorted(image_hashes)}


@contextlib.contextmanager
def locked(path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.with_suffix('.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        yield


def initialize(recipe_path, root, state_path):
    recipe_path, root, state_path = map(Path, [recipe_path, root, state_path])
    recipe = json.loads(recipe_path.read_text())
    assets = recipe['assets']
    if recipe['credits_per_asset'] != 30 or recipe['budget_credits'] <= 0:
        raise ValueError('Only reviewed 30-credit Meshy 7 preset is supported')
    settings = recipe['settings']
    expected = {'ai_model': 'meshy-7', 'model_type': 'standard', 'should_texture': True,
                'enable_pbr': True, 'texture_resolution': '2k', 'ultra_mode': False,
                'target_formats': ['glb']}
    if any(settings.get(k) != v for k, v in expected.items()):
        raise ValueError('Settings differ from approved cost preset')
    allowed = set(expected) | {'should_remesh', 'topology', 'symmetry_mode', 'origin_at', 'remove_lighting', 'response_format'}
    if set(settings) - allowed:
        raise ValueError('Unreviewed Meshy setting')
    if len(assets) * 30 > recipe['budget_credits']:
        raise ValueError('Batch exceeds authorized budget')
    jobs = {}
    for asset in assets:
        aid = asset['id']
        if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', aid) or aid in jobs:
            raise ValueError('Invalid or duplicate asset ID')
        source = root / 'assets' / aid / 'source/input.png'
        if any((root/'assets'/aid/p).exists() for p in ['meshy_raw/model.glb', 'final/model.glb']):
            raise ValueError('Asset output already exists; use a new versioned asset ID')
        if asset['target_height'] <= 0 or not 100 <= asset['target_polycount'] <= 300000:
            raise ValueError('Invalid asset dimensions or topology budget')
        jobs[aid] = {**asset, 'source': str(source.resolve()), 'source_sha256': sha(source),
                     'status': 'READY', 'reserved_credits': 0}
    with locked(state_path):
        if state_path.exists():
            raise ValueError('State already exists; resume, never overwrite')
        state = {**recipe, 'assets': jobs, 'created_at': now(), 'root': str(root.resolve()),
                 'recipe_sha256': sha(recipe_path), 'reserved_credits': 0}
        write_json(state_path, state)
    return state


def transition(state_path, command, aid, payload=None):
    state_path = Path(state_path)
    with locked(state_path):
        state = json.loads(state_path.read_text())
        job = state['assets'][aid]
        if command == 'reserve':
            if job['status'] != 'READY':
                raise ValueError('Already reserved/submitted. Do not regenerate; recover task ID.')
            if sha(job['source']) != job['source_sha256']:
                raise ValueError('Source changed after approval')
            if state['reserved_credits'] + 30 > state['budget_credits']:
                raise ValueError('Credit budget exhausted')
            state['reserved_credits'] += 30
            job.update(status='SUBMISSION_UNCERTAIN', reserved_credits=30, submitted_at=now())
            result = {'tool': 'meshy_image_to_3d', 'arguments': {**state['settings'],
                      'file_path': job['source'], 'target_polycount': job['target_polycount']}}
            job['request'] = result
        elif command == 'attach':
            task_id = payload['task_id']
            if job['status'] != 'SUBMISSION_UNCERTAIN' or not re.fullmatch(r'[0-9a-f-]{36}', task_id):
                raise ValueError('Invalid task attachment or state')
            if any(j.get('task_id') == task_id for j in state['assets'].values()):
                raise ValueError('Task ID already attached')
            job.update(task_id=task_id, status='SUBMITTED')
            result = job
        elif command == 'result':
            if job['status'] not in ['SUBMITTED', 'IN_PROGRESS'] or payload['task_id'] != job['task_id']:
                raise ValueError('Wrong task/state')
            status = payload['status']
            if status not in ['PENDING', 'IN_PROGRESS', 'SUCCEEDED', 'FAILED', 'CANCELED']:
                raise ValueError('Unsupported status')
            cost = payload.get('consumed_credits')
            if cost is not None and (not isinstance(cost, (float, int)) or not 0 <= cost <= 30):
                raise ValueError('Unexpected charge; stop batch and investigate')
            job.update(status='IN_PROGRESS' if status == 'PENDING' else status, consumed_credits=cost)
            if status in ['SUCCEEDED', 'FAILED', 'CANCELED']:
                job['completed_observed_at'] = now()
            result = job
        elif command == 'downloaded':
            if job['status'] != 'SUCCEEDED':
                raise ValueError('Task is not succeeded')
            raw = Path(state['root']) / 'assets' / aid / 'meshy_raw/model.glb'
            job.update(raw=glb_info(raw), status='DOWNLOADED')
            result = job
        elif command == 'adjust':
            if job['status'] not in ['DOWNLOADED', 'VERIFIED']:
                raise ValueError('Adjustment requires a downloaded asset')
            if not payload or set(payload) - {'target_height', 'yaw_degrees'}:
                raise ValueError('Only local scale/orientation adjustments are allowed')
            if any(not isinstance(v, (int, float)) or not math.isfinite(v) for v in payload.values()):
                raise ValueError('Adjustment must be finite')
            if payload.get('target_height', 1) <= 0:
                raise ValueError('Height must be positive')
            job.update(payload)
            job.update(status='DOWNLOADED', visual_review='PENDING')
            result = job
        elif command == 'verified':
            if job['status'] not in ['DOWNLOADED', 'VERIFIED']:
                raise ValueError('Raw download missing')
            base = Path(state['root']) / 'assets' / aid
            if sha(base / 'meshy_raw/model.glb') != job['raw']['sha256']:
                raise ValueError('Raw was modified')
            final = glb_info(base / 'final/model.glb')
            report = json.loads((base / 'final/verification.json').read_text())
            if report.get('final_sha256') != final['sha256'] or report.get('raw_sha256') != job['raw']['sha256']:
                raise ValueError('Verification report does not match current GLB bytes')
            if final['triangles'] != job['raw']['triangles'] or final['image_hashes'] != job['raw']['image_hashes']:
                raise ValueError('Geometry count or embedded textures changed')
            if final['nodes'] != final['meshes'] or not report['reimport_pass']:
                raise ValueError('Unexpected export objects or reimport failure')
            if abs(report['after']['dimensions'][2] - job['target_height']) > 1e-5:
                raise ValueError('Verification dimensions differ from manifest')
            job.update(final=final, status='VERIFIED', visual_review=job.get('visual_review', 'PENDING'))
            result = job
        else:
            raise ValueError('Unknown command')
        write_json(state_path, state)
        return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['init', 'show', 'reserve', 'attach', 'result', 'downloaded', 'adjust', 'verified'])
    parser.add_argument('--state', required=True)
    parser.add_argument('--recipe')
    parser.add_argument('--root', default='.')
    parser.add_argument('--asset')
    parser.add_argument('--payload', help='JSON file containing MCP structuredContent (not signed URLs)')
    args = parser.parse_args()
    if args.command == 'init':
        result = initialize(args.recipe, args.root, args.state)
    elif args.command == 'show':
        result = json.loads(Path(args.state).read_text())
    else:
        payload = json.loads(Path(args.payload).read_text()) if args.payload else None
        result = transition(args.state, args.command, args.asset, payload)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
