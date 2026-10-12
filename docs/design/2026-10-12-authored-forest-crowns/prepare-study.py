"""Metadata preparation only. No GLB vertices, domain compilation or Blender execution."""
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = Path('/Users/yutogasaki/Projects/sansu')
C1 = Path('/private/tmp/sansu-authored-shoulder-c1/candidate')
EVIDENCE = Path('/private/tmp/sansu-authored-shoulder-c1/shape-after-first-oom/actual')
INVENTORY = Path('/private/tmp/sansu-forest-role-inventory')
def read(path): return json.loads(path.read_text())
def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''): h.update(chunk)
    return h.hexdigest()
def save(name, value):
    path = HERE / name
    assert not path.exists(), f'Preserve existing preparation: {path}'
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')

report = read(EVIDENCE / 'report.json')
assert report['pass'] and report['shapeOnly'] and len(report['captures']) == 2
captures = []
for item in report['captures']:
    path = EVIDENCE / item['file']
    assert digest(path) == item['sha256']
    assert item['build'] == 'authored-shoulder-c1'
    captures.append({key: item[key] for key in ['file', 'sha256', 'build', 'appVersion', 'viewport', 'url']}
                    | {'path': str(path), 'camera': json.loads(item['metadata']['growingCamera'])})
state_path = C1 / 'prototypes/place-qa/authored-shoulder-reference-mature.json'
state = read(state_path)['state']
inventory = read(INVENTORY / 'inventory.json')
anchors = read(INVENTORY / 'anchors.json')
kit_path = C1 / 'docs/design/2026-10-11-native-owned-island/kit-manifest.json'
kit = read(kit_path)
targets = {'l14': ('willow', 1.3), 'l15': ('birch', 1.3), 'l28': ('spire', 1), 'l29': ('birch', 1)}
frozen = {'willow': ['trunk', 'ground-root', 'bark-ridge'], 'birch': ['trunk', 'bark-mark'], 'spire': ['trunk']}
owners = {}
for owner_id, (species, age_scale) in targets.items():
    record = next(owner for owner in state['landmarks'] if owner['id'] == owner_id)
    description = kit['parts'][species]
    pivot = [-8, 1.24, -2.7] if species == 'willow' else [
        (description['min'][0] + description['max'][0]) / 2, description['min'][1],
        (description['min'][2] + description['max'][2]) / 2]
    roles = [dict(node, fixed=node['role'] in frozen[species]) for node in inventory['nodes'] if node['species'] == species]
    assert set(description['sourceNames']) == {node['name'] for node in roles}
    owners[owner_id] = {'species': species, 'record': record, 'age': 'big' if age_scale == 1.3 else 'mature',
        'sourceScale': .45, 'ageScale': age_scale, 'expectedUniformScale': .45 * age_scale,
        'pivotSourceGltf': pivot, 'roles': roles, 'matrixStatus': 'Pending exact c1 objectLayer extraction; never infer y from source benchmark'}

def shape(sx, sy, sz, yaw=0, shift=(0, 0, 0)):
    return {'stretch': [sx, sy, sz], 'yawDegrees': yaw, 'upperShiftWorld': list(shift)}
variants = [
    {'id': 'forest-crown-b1-low-wide-v0', 'name': '低く広い三段冠', 'purpose': '左の四個体を低い葉面として重ね、家と通路の下部を開く。肩3木は原形。',
     'owners': {'l14': shape(1.38, .94, 1.18), 'l15': shape(1.35, .88, 1.15, -12, (.12, 0, .04)),
                'l28': shape(1.10, 1, 1.10), 'l29': shape(1.40, .90, 1.12, 18, (-.10, 0, -.02))}},
    {'id': 'forest-crown-b2-rising-v0', 'name': '斜めに上がる冠', 'purpose': '前の低い白樺から奥の柳へ段差を付け、最高大樹を第二冠で隠さない。',
     'owners': {'l14': shape(1.16, 1.04, 1.34, 12, (-.08, .08, -.08)), 'l15': shape(1.20, 1.06, 1.34, -8, (0, .13, -.10)),
                'l28': shape(1.05, 1, 1.12), 'l29': shape(1.45, .82, 1.05, 10, (-.15, -.08, -.06))}},
    {'id': 'forest-crown-b3-open-crescent-v0', 'name': '開いた三日月冠', 'purpose': '外周に葉量を寄せ、家/ベンチ側の中央開口を保つ。全群を一つの屋根にしない。',
     'owners': {'l14': shape(1.28, .98, 1.12, -10, (-.16, 0, -.12)), 'l15': shape(1.32, 1, 1.08, 18, (-.14, .06, .06)),
                'l28': shape(1.12, 1, 1.05), 'l29': shape(1.42, .94, 1.15, -14, (.10, -.02, -.08))}},
]
for variant in variants:
    variant['status'] = 'Unexecuted rough-shape parameters, not accepted physical or visual dimensions'
    variant['maxChangedWorldVertexDisplacement'] = .85
    variant['heroTopClearanceWorld'] = .25
    variant['willowJunction'] = {'count': 5, 'radialSegments': 10, 'longitudinalSegments': 16,
        'rootRadiusFractionOfSourceTrunkTip': .75, 'tipRadiusWorld': .026,
        'surfacePenetrationWorld': .025, 'archRiseWorld': .09, 'maxSpanWorld': 1.8,
        'construction': 'closed taper from exact original upper-trunk surface into each existing lobe surface; original trunk remains unchanged',
        'pending': 'actual overlap/full actor bands/closed branch audit; no support PASS from recipe anchors'}

original = REPO / 'docs/design/2026-10-10-island-final-3d/whole-island.glb'
paths = [original, original.with_suffix('.blend'), original.parent / 'whole-island-render.png',
    state_path, kit_path, EVIDENCE / 'report.json', *[Path(c['path']) for c in captures],
    INVENTORY / 'inventory.json', INVENTORY / 'anchors.json',
    C1 / 'prototypes/place-qa/native05-world-source-shading.json.gz',
    C1 / 'prototypes/place-qa/authored-shoulder-profile.json.gz',
    C1 / 'prototypes/place-qa/native-shoulder-manifest.json',
    C1 / 'docs/design/2026-10-12-authored-cove-entrance/cove-delivery-manifest.json',
    C1 / 'package-lock.json']
hashes = {str(p): {'sha256': digest(p), 'bytes': p.stat().st_size} for p in paths}
assert hashes[str(original)]['sha256'] == kit['sourceSha256'] == '8398eda9ac084a6e80ed22f1a82670c380b017544a177106325aaa7ba7f8f68d'
save('study.json', {'version': 1, 'status': 'Prepared; no extraction/Blender/render/geometry audit executed',
    'runtimeRepo': str(C1), 'originalSource': str(original), 'sourceSha256': kit['sourceSha256'],
    'referenceStatePath': str(state_path), 'referenceState': state, 'evidence': captures,
    'benchmark': str(original.parent / 'whole-island-render.png'), 'owners': owners, 'anchors': anchors,
    'fixedOwnerIds': ['l33', 'l34', 'l35'], 'fixedSharedHeroOwnerIds': ['l10', 'l11', 'l12', 'l13'],
    'variants': variants, 'inputs': hashes, 'independentObservers': 0, 'runtimeIntegrated': False,
    'coordinates': {'source': 'original glTF Y-up', 'study': 'authored world Y-up', 'blender': '[world.x, -world.z, world.y]',
        'sourceToWorld': 'exact authored tree matrixWorld * translation(-native kit pivot) * original mesh matrixWorld',
        'rendererToWorld': '[+layout.center, 0, +2]; exactly once'}})
assert {str(p): {'sha256': digest(p), 'bytes': p.stat().st_size} for p in paths} == hashes
save('preparation.json', {'sourceInputsUnchanged': True, 'inputCount': len(paths), 'owners': list(owners),
    'roleNodeInstances': sum(len(owner['roles']) for owner in owners.values()),
    'fixedRoleNodeInstances': sum(sum(node['fixed'] for node in owner['roles']) for owner in owners.values()),
    'geometryCreated': False, 'domainCompiled': False, 'blenderExecuted': False, 'renderExecuted': False,
    'runtimeIntegrated': False, 'independentObservers': 0, 'studySha256': digest(HERE / 'study.json')})
print(json.dumps(read(HERE / 'preparation.json')))
