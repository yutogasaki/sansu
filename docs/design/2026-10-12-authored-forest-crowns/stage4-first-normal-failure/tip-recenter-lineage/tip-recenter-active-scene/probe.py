"""Bounded leaf representation probe. No source changes, whole build, or render."""
import os
assert os.environ.get('SANSU_FOREST_TIP_RECENTER_APPROVED')=='1','Await separate source window'
import bpy
import gzip
import hashlib
import json
import math
import sys
import traceback
from pathlib import Path
from mathutils import Matrix,Vector

HERE=Path(__file__).resolve().parent;DEBUG=HERE.parent;STAGE=DEBUG.parent;BASE=STAGE.parent
sys.dont_write_bytecode=True;sys.path[:0]=[str(HERE),str(STAGE)]
import geometry as g
import fields
import source_helpers as native
import source_checks as checks
from export_check import read_glb,compare_triangles
from export_isolation import isolated_export_scene
from world_check import glb_world_report

sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
OUT=HERE/'attempt-01';assert not OUT.exists(),'No retry';OUT.mkdir()
BOUND=json.loads((HERE/'readiness.json').read_text())['externalInputs']
assert {p:sha(Path(p)) for p in BOUND}==BOUND
RAW=json.loads(gzip.decompress((DEBUG/'attempt-01/failing-role-raw.json.gz').read_bytes()))
SOURCE=json.loads(gzip.decompress((DEBUG/'attempt-01/source-role-accessors.json.gz').read_bytes()))['extracted']
PRIOR=json.loads(gzip.decompress((DEBUG/'sharp-fan-comparison/attempt-01/comparison-raw.json.gz').read_bytes()))
P=json.loads((STAGE/'proposal.json').read_text())
B=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)));BI=B.inverted()
phase='import'


def save(name,value):
    data=(json.dumps(value,indent=2,allow_nan=False)+'\n').encode()
    (OUT/name).write_bytes(gzip.compress(data,mtime=0) if name.endswith('.gz') else data)


def vecs(values):return [list(value) for value in values]
def sharp(mesh):return {','.join(map(str,sorted(e.vertices))):bool(e.use_edge_sharp) for e in mesh.edges}
def yup(v):return [v[0],v[2],-v[1]]


def residuals(actual,expected):
    assert len(actual)==len(expected)
    values=[math.dist(a,b) for a,b in zip(actual,expected)]
    return {'maxL2':max(values),'over002':sum(v>.002 for v in values),
            'failedCorners':[i for i,v in enumerate(values) if v>.002]}


def triangles(mesh,normals):
    return [{'positions':[yup(mesh.vertices[mesh.loops[i].vertex_index].co) for i in polygon.loop_indices],
             'normals':[yup(normals[i]) for i in polygon.loop_indices]} for polygon in mesh.polygons]


def canonical_material(raw):
    # Existing source checks reject textures rather than silently drop them.
    result=checks.material_spec(raw)
    result['alphaCutoff']=raw.get('alphaCutoff',.5)
    result['extensions']=raw.get('extensions',{})
    return result


def component_snapshot(obj):
    mesh=obj.data
    material_rows=[]
    for mat in mesh.materials:
        row={'name':mat.name,'diffuse':list(mat.diffuse_color),'roughness':mat.roughness,
             'metallic':mat.metallic,'backfaceCulling':mat.use_backface_culling,
             'useNodes':mat.use_nodes,'nodes':[],'links':[]}
        if mat.node_tree:
            for node in mat.node_tree.nodes:
                inputs=[]
                for socket in node.inputs:
                    if not hasattr(socket,'default_value'):continue
                    value=socket.default_value
                    if not isinstance(value,(int,float,bool,str)):
                        try:value=list(value)
                        except TypeError:value=str(value)
                    inputs.append([socket.name,value])
                row['nodes'].append([node.name,node.bl_idname,inputs,getattr(getattr(node,'image',None),'name',None)])
            row['links']=sorted([link.from_node.name,link.from_socket.name,link.to_node.name,link.to_socket.name] for link in mat.node_tree.links)
        material_rows.append(row)
    values={'positions':vecs(v.co for v in mesh.vertices),
        'loopVertexIndices':[loop.vertex_index for loop in mesh.loops],
        'cornerNormals':vecs(n.vector for n in mesh.corner_normals),
        'matrixWorld':vecs(obj.matrix_world),'sharpFlags':sharp(mesh),
        'materials':material_rows,
        'polygonVertices':[list(p.vertices) for p in mesh.polygons],
        'polygonSmooth':[p.use_smooth for p in mesh.polygons],
        'parent':{'name':obj.parent.name if obj.parent else None,'matrixWorld':vecs(obj.parent.matrix_world) if obj.parent else None}}
    return {'raw':values,'sha256':{k:hashlib.sha256(json.dumps(v,sort_keys=True,allow_nan=False).encode()).hexdigest() for k,v in values.items()}}


def export_only(obj,path,expected,source_material):
    digest=native.fixed_digest(obj);flags=sharp(obj.data)
    observed_before=component_snapshot(obj)
    save(path.stem+'-before-export.json.gz',{'fixedDigest':digest,'components':observed_before})
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,use_active_scene=True,
        export_normals=True,export_apply=False,export_yup=True,export_extras=True,
        export_animations=False,export_cameras=False,export_lights=False,export_materials='EXPORT')
    observed_after_digest=native.fixed_digest(obj);observed_after_flags=sharp(obj.data)
    observed_after=component_snapshot(obj)
    save(path.stem+'-after-export.json.gz',{'fixedDigest':observed_after_digest,'components':observed_after})
    save(path.stem+'-export-component-comparison.json',{
        'fixedDigestEqual':observed_after_digest==digest,'sharpFlagsEqual':observed_after_flags==flags,
        'componentsEqual':{k:observed_before['sha256'][k]==observed_after['sha256'][k] for k in observed_before['sha256']},
        'before':observed_before['sha256'],'after':observed_after['sha256'],
        'guard':'disposable copy: all components except matrix exact; original scene/object/parent exact guarded separately; emitted world <=1e-6'})
    # The disposable export object may be reevaluated. Its shape/shading must stay exact.
    # Authoring scene exact invariance is enforced by isolated_export_scene before/after.
    assert all(observed_before['sha256'][k]==observed_after['sha256'][k]
               for k in observed_before['sha256'] if k!='matrixWorld')
    assert sharp(obj.data)==flags
    scope_doc=checks.glb_json(path)
    scope_nodes=[n for n in scope_doc.get('nodes',[]) if 'mesh' in n]
    scope_triangles=sum(scope_doc['accessors'][p['indices']]['count']//3
        for n in scope_nodes for p in scope_doc['meshes'][n['mesh']]['primitives'])
    scope={'scenes':len(scope_doc.get('scenes',[])),'meshNodes':len(scope_nodes),
        'meshNames':[n.get('name') for n in scope_nodes],'expectedName':obj.name,
        'triangles':scope_triangles,'expectedTriangles':len(expected),
        'use_selection':True,'use_active_scene':True}
    save(path.stem+'-scope-before-assert.json',scope)
    assert scope['scenes']==1 and scope['meshNodes']==1 and scope['meshNames']==[obj.name]
    assert scope['triangles']==len(expected)==148
    doc,node,actual,attributes=read_glb(path)
    comparison=compare_triangles(actual,expected)
    save(path.stem+'-geometry-before-assert.json',comparison)
    assert comparison['physicalTriangleMultisetExact'] and comparison['orientedTriangleCount']==148
    world_report=glb_world_report(doc,node,attributes,profile['tipRelative32'],profile['targets64'])
    materials=[canonical_material(doc['materials'][primitive['material']]) for primitive in doc['meshes'][node['mesh']]['primitives']]
    material_ok=all(checks.close_values(mat,source_material) for mat in materials)
    save(path.stem+'-accessors.json.gz',{'node':node,'nodes':doc['nodes'],'attributes':attributes,
        'materials':doc.get('materials',[]),'sourceMaterialCanonical':source_material})
    return {'file':path.name,'sha256':sha(path),'bytes':path.stat().st_size,
            'normalAndPositionComparison':comparison,'world':world_report,'materialPBRAndExtensionsPreserved':material_ok,
            'passed':comparison['physicalTriangleMultisetExact'] and comparison['normalMaxL2']<=.002 and material_ok and world_report['passed']}


try:
    assert bpy.app.build_hash.decode()=='9e2066aef7ef'
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(BASE/'extraction-attempt02/fixed-c1-context.glb'));context=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(BASE/'extraction-attempt02/role-separated-originals.glb'))
    originals=[obj for obj in bpy.data.objects if obj.type=='MESH']
    old_digests={obj.name:native.fixed_digest(obj) for obj in originals}
    old_flags={obj.name:sharp(obj.data) for obj in originals}
    original_materials=list(bpy.data.materials)
    old_materials={mat.name:checks.material_digest(mat) for mat in original_materials}
    original=next(obj for obj in originals if obj not in context and obj.get('ownerId')=='l14' and obj.get('sourceNodeIndex')==2239)
    mesh=original.data;owner_parent=original.parent
    parent_matrix=owner_parent.matrix_world.copy() if owner_parent else None
    assert vecs([v.co for v in mesh.vertices])==RAW['inputLocalPositions']
    assert [loop.vertex_index for loop in mesh.loops]==SOURCE['indices']
    positions=RAW['inputLocalPositions'];edges=[list(edge.vertices) for edge in mesh.edges]
    original_faces=[list(p.vertices) for p in mesh.polygons]
    zero=g.exact_zero_faces(positions,original_faces);assert zero==[0,2,98,100]
    keep=[i for i in range(len(original_faces)) if i not in zero];faces=[original_faces[i] for i in keep]
    source_loops=[i for f in keep for i in mesh.polygons[f].loop_indices]
    raw_normals=[[n[0],-n[2],n[1]] for n in SOURCE['normals']]
    input_payload=[raw_normals[mesh.loops[i].vertex_index] for i in source_loops]
    profile=g.profile(positions,raw_normals,RAW['localToWorld'],fields.field_for_role('l14','hanging-leaf',0,P))
    desired=[profile['desiredNormalsByVertex64'][mesh.loops[i].vertex_index] for i in source_loops]
    save('float64-profile.json.gz',profile)
    doc=checks.glb_json(BASE/'extraction-attempt02/role-separated-originals.glb')
    node=next(n for n in doc['nodes'] if n.get('extras',{}).get('ownerId')=='l14' and n.get('extras',{}).get('sourceNodeIndex')==2239)
    primitives=doc['meshes'][node['mesh']]['primitives'];assert len(primitives)==1
    source_material=canonical_material(doc['materials'][primitives[0]['material']])
    configs=[('six-incident-sharp',PRIOR[1])]
    records=[]

    def clone(name,coords,flags,normals,matrix):
        obj=original.copy();obj.name='TIP RECENTER DIAGNOSTIC / '+name
        obj.data=bpy.data.meshes.new(obj.name);obj.data.from_pydata(coords,edges,faces);obj.data.update()
        for mat in mesh.materials:obj.data.materials.append(mat)
        for polygon,source_face in zip(obj.data.polygons,keep):
            polygon.use_smooth=mesh.polygons[source_face].use_smooth;polygon.material_index=mesh.polygons[source_face].material_index
        for edge in obj.data.edges:edge.use_edge_sharp=flags[','.join(map(str,sorted(edge.vertices)))]
        bpy.context.scene.collection.objects.link(obj);obj.matrix_world=matrix
        assert obj.parent==owner_parent and not obj.data.has_custom_normals
        obj.data.normals_split_custom_set(normals)
        assert [list(p.vertices) for p in obj.data.polygons]==faces
        assert [p.use_smooth for p in obj.data.polygons]==[mesh.polygons[i].use_smooth for i in keep]
        assert sharp(obj.data)==flags
        return obj

    for config,prior in configs:
        flags={key:config=='all-sharp' or 38 in map(int,key.split(',')) for key in sharp(mesh)}
        phase=config+':input-source-oracle'
        inp=clone(config+'-input',positions,flags,input_payload,original.matrix_world.copy())
        inp_readback=vecs([n.vector for n in inp.data.corner_normals])
        assert inp_readback==prior['storedBeforeField'],'Input must reproduce recorded matched flag condition'
        input_stat=residuals(inp_readback,input_payload)
        for centered in [True]:
            name=config+('-tip-recenter' if centered else '-old-pivot64-control')
            phase=name+':fresh-deformed-mesh'
            coords=profile['tipRelative32'] if centered else profile['oldPivot32']
            matrix=B@Matrix(profile['compensatedTransform64']) if centered else original.matrix_world.copy()
            obj=clone(name,coords,flags,desired,matrix)
            actual=vecs([n.vector for n in obj.data.corner_normals]);normal_stat=residuals(actual,desired)
            assert vecs([v.co for v in obj.data.vertices])==coords
            actual_t=vecs(BI@obj.matrix_world)
            world=[g.point(actual_t,p) for p in coords]
            world_error=[math.dist(a,b) for a,b in zip(world,profile['targets64'])]
            zero_after=g.exact_zero_faces(coords,faces)
            # This secondary GPU-like world cast is recorded distinctly from local authoring topology.
            world32=[[g.f32(x) for x in p] for p in world]
            world32_zero=g.exact_zero_faces(world32,faces)
            record={'variant':name,'inputSourceNormalOracle':input_stat,'desiredSourceNormalOracle':normal_stat,
                'normalToleranceUnchanged':.002,'rawSourceNormalTransport':'Float64 central-J epsilon1e-5, A^T J^-T A^-T, normalized; never imported altered NORMAL',
                'freshMeshWithoutInheritedCustomNormalData':True,'vertexCount':len(coords),'retainedTriangles':len(faces),
                'originalSourceFaceMap':keep,'excludedExactlyZeroInputFaces':zero,
                'nonzeroLocalRetainedTriangles':len(faces)-len(zero_after),
                'zeroLocalSourceFaces':[keep[i] for i in zero_after],
                'zeroAfterFloat32WorldCastSourceFaces':[keep[i] for i in world32_zero],
                'worldPositions64':world,'worldErrorPerVertex':world_error,'maxWorldError':max(world_error),
                'diagnosticWorldErrorBound':1e-6,'originalMatrix':vecs(original.matrix_world),'newChildMatrix':vecs(obj.matrix_world),
                'parentName':owner_parent.name if owner_parent else None,'originalParentMatrix':vecs(parent_matrix) if parent_matrix else None,
                'ownerParentUnchanged':obj.parent==owner_parent and (owner_parent is None or owner_parent.matrix_world==parent_matrix),
                'literalOriginalLocalPositionsRetained':False,'topologyClaim':'148 diagnostic retained faces, not original152 topology',
                'sourceNormals':input_payload,'desiredSourceNormals':desired,'storedNormals':actual,
                'sharpFlags':flags,'localPositions':coords,'sourceCorrectionAdopted':False,'roundtrip':None}
            eligible=input_stat['maxL2']<=.002 and normal_stat['maxL2']<=.002 and not zero_after and max(world_error)<=1e-6
            record['eligibleForStandaloneRoundtrip']=eligible
            if eligible:
                phase=name+':standalone-glb-roundtrip'
                expected=triangles(obj.data,desired)
                save(name+'-pre-export-oracle.json.gz',record)
                with isolated_export_scene(obj,save,native,checks) as export_obj:
                    first=export_only(export_obj,OUT/(name+'-first.glb'),expected,source_material)
                    before_objects=set(bpy.data.objects)
                    bpy.ops.import_scene.gltf(filepath=str(OUT/(name+'-first.glb')))
                    imported=[o for o in bpy.data.objects if o not in before_objects and o.type=='MESH']
                    assert len(imported)==1
                    imported=imported[0]
                    reimport_cmp=compare_triangles(triangles(imported.data,[n.vector for n in imported.data.corner_normals]),expected)
                    reimport_zeros=g.exact_zero_faces(vecs([v.co for v in imported.data.vertices]),[list(p.vertices) for p in imported.data.polygons])
                    matrix_error=max(abs(imported.matrix_world[i][j]-export_obj.matrix_world[i][j]) for i in range(4) for j in range(4))
                    reimport_t=vecs(BI@imported.matrix_world)
                    reimport_world=[g.point(reimport_t,p) for p in profile['tipRelative32']]
                    reimport_errors=[math.dist(a,b) for a,b in zip(reimport_world,profile['targets64'])]
                    second=export_only(imported,OUT/(name+'-second.glb'),expected,source_material)
                    record['roundtrip']={'firstExport':first,'blenderReimport':reimport_cmp,'reimportLocalZeroTriangles':reimport_zeros,
                        'reimportMatrixMaxElementError':matrix_error,'reimportWorldErrorPerVertex':reimport_errors,
                        'reimportMaxWorldError':max(reimport_errors),'secondExport':second,
                        'passed':first['passed'] and second['passed'] and reimport_cmp['physicalTriangleMultisetExact']
                            and reimport_cmp['normalMaxL2']<=.002 and not reimport_zeros and matrix_error<=1e-6 and max(reimport_errors)<=1e-6}
            records.append(record);save('variants-so-far.json.gz',records)
    phase='input-parity'
    assert old_digests=={obj.name:native.fixed_digest(obj) for obj in originals}
    assert old_flags=={obj.name:sharp(obj.data) for obj in originals}
    assert old_materials=={mat.name:checks.material_digest(mat) for mat in original_materials}
    save('result.json',{'status':'DIAGNOSTIC ONLY; no normalization or stage4 adoption',
        'variants':[{'variant':r['variant'],'inputSourceNormalOracle':r['inputSourceNormalOracle'],
            'desiredSourceNormalOracle':r['desiredSourceNormalOracle'],'nonzeroLocalRetainedTriangles':r['nonzeroLocalRetainedTriangles'],
            'zeroLocalSourceFaces':r['zeroLocalSourceFaces'],'zeroAfterFloat32WorldCastSourceFaces':r['zeroAfterFloat32WorldCastSourceFaces'],
            'maxWorldError':r['maxWorldError'],'roundtrip':r['roundtrip']} for r in records],
        'allOriginalMeshesUnchanged':len(originals),'originalMaterialDigestsUnchanged':old_materials,
        'ownerRootTransformsUnchanged':True,'geometryExclusion':'Only the four original exact-zero faces excluded on diagnostic clones; originals retain all152.',
        'rendered':False,'blenderBuildHash':bpy.app.build_hash.decode(),
        'limitations':['Single leaf only.','Local nonzero faces are distinct from sub-ULP world/GPU triangles.',
                       'No joint/closure/actor/full101/source-art or runtime acceptance.']})
except BaseException as error:
    save('diagnostic-failure.json',{'phase':phase,'error':repr(error),'traceback':traceback.format_exc()});raise
finally:
    after={p:sha(Path(p)) for p in BOUND};save('input-parity.json',{'before':BOUND,'after':after,'equal':BOUND==after});assert BOUND==after
