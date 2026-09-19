"""PNG texture downsampling in Blender; preserve source GLB and all mesh attributes."""
import hashlib
import json
from pathlib import Path
import struct

import bpy


def glb(path):
    data = Path(path).read_bytes()
    length = struct.unpack_from('<I', data, 12)[0]
    return json.loads(data[20:20+length]), data[28+length:]


def geometry_digest(path):
    doc, binary = glb(path)
    parts = []
    for mesh in doc['meshes']:
        for primitive in mesh['primitives']:
            for name, index in sorted({**primitive['attributes'], 'indices':primitive['indices']}.items()):
                accessor = doc['accessors'][index]
                view = doc['bufferViews'][accessor['bufferView']]
                start = view.get('byteOffset',0)
                parts.append((name, accessor['count'], hashlib.sha256(binary[start:start+view['byteLength']]).hexdigest()))
    return parts


def preserve_geometry(source, texture_export, destination):
    """Replace only embedded image bufferViews; retain original accessor bytes and scene."""
    original, binary = glb(source)
    resized, resized_binary = glb(texture_export)
    strip_names=lambda mats:[{k:v for k,v in m.items() if k!='name'} for m in mats]
    assert strip_names(original['materials']) == strip_names(resized['materials'])
    assert len(original['images']) == len(resized['images'])
    replacements={}
    for old,new in zip(original['images'],resized['images']):
        old['mimeType'] = new['mimeType']
        view=resized['bufferViews'][new['bufferView']];offset=view.get('byteOffset',0)
        replacements[old['bufferView']]=resized_binary[offset:offset+view['byteLength']]
    packed=bytearray()
    for index,view in enumerate(original['bufferViews']):
        old_offset=view.get('byteOffset',0)
        content=replacements.get(index,binary[old_offset:old_offset+view['byteLength']])
        while len(packed)%4: packed.append(0)
        view['byteOffset']=len(packed);view['byteLength']=len(content)
        packed.extend(content)
    while len(packed)%4: packed.append(0)
    original['buffers'][0]['byteLength']=len(packed)
    metadata=json.dumps(original,separators=(',',':')).encode()
    metadata+=b' '*((-len(metadata))%4)
    total=12+8+len(metadata)+8+len(packed)
    Path(destination).write_bytes(struct.pack('<III',0x46546c67,2,total)+struct.pack('<II',len(metadata),0x4e4f534a)+metadata+struct.pack('<II',len(packed),0x004e4942)+packed)


def optimize(root, aid, size=1024):
    if size not in [512,1024]:
        raise ValueError('Reviewed texture presets: 512 or 1024')
    base = Path(root)/'assets'/aid
    source = base/'final/model.glb'
    output = base/'optimized'
    output.mkdir(exist_ok=True)
    scene = bpy.data.scenes.new(aid+'-texture-'+str(size))
    bpy.context.window.scene = scene
    bpy.ops.import_scene.gltf(filepath=str(source))
    meshes = [o for o in scene.objects if o.type=='MESH']
    images = set()
    for obj in meshes:
        for material in obj.data.materials:
            for node in material.node_tree.nodes:
                if node.type=='TEX_IMAGE' and node.image:
                    images.add(node.image)
    sizes=[]
    for image in images:
        before = list(image.size)
        ratio = min(1,size/max(before))
        image.scale(max(1,round(before[0]*ratio)),max(1,round(before[1]*ratio)))
        image.pack()
        sizes.append({'before':before,'after':list(image.size),'color_space':image.colorspace_settings.name})
    for obj in scene.objects:
        obj.select_set(obj in meshes)
    bpy.context.view_layer.objects.active = meshes[0]
    import io_scene_gltf2
    assert 'GLB' in [item[0] for item in io_scene_gltf2.get_format_items(None,bpy.context)]
    target=output/f'model-{size}.glb'
    bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_apply=True)
    preserve_geometry(source,target,target)
    before_geo, after_geo = geometry_digest(source), geometry_digest(target)
    assert before_geo==after_geo, 'Geometry/UV/normal accessor bytes changed'
    doc,binary=glb(target)
    png_sizes=[]
    for image in doc['images']:
        view=doc['bufferViews'][image['bufferView']]; start=view.get('byteOffset',0)
        pixels=binary[start:start+view['byteLength']]
        assert pixels[:8]==b'\x89PNG\r\n\x1a\n'
        dimensions=struct.unpack_from('>II',pixels,16)
        assert max(dimensions)<=size
        png_sizes.append(dimensions)
    original_doc,_=glb(source)
    # Material names may acquire Blender suffixes; maps and physical parameters must match.
    strip_names=lambda mats:[{k:v for k,v in m.items() if k!='name'} for m in mats]
    assert strip_names(original_doc['materials'])==strip_names(doc['materials'])
    report={'asset':aid,'preset':f'png-{size}','source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
            'output_sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
            'source_bytes':source.stat().st_size,'output_bytes':target.stat().st_size,
            'reduction_percent':round(100*(1-target.stat().st_size/source.stat().st_size),2),
            'images':sizes,'embedded_png_sizes':png_sizes,'geometry_uv_normals_identical':True,
            'pbr_parameters_identical':True,'triangles':sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives']),
            'visual_acceptance':'PENDING_BROWSER_COMPARE','blender_version':bpy.app.version_string}
    (output/f'profile-{size}.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report))
    return report
