#!/usr/bin/env python3
"""Export the saved stage4 HOLD trees once; --check verifies delivery without Blender.
No re-authoring, render, source repair, normal recalculation or precision retry.
"""
from pathlib import Path
import gzip,hashlib,json,os,struct,sys,time,subprocess,signal,math
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[1]
FOREST=ROOT/'docs/design/2026-10-12-authored-forest-crowns'
SOURCE=FOREST/'stage4-whole-hold/v4/attempt-hold-01/HOLD-diagnostic-assembly-after-joints.blend'
SCOPE=SOURCE.parent/'HOLD-diagnostic-assembly-after-joints-scope-classification.json'
BINDINGS=FOREST/'extraction-attempt02/bindings.json'
KIT=ROOT/'docs/design/2026-10-11-native-owned-island/kit-manifest.json'
SUMMARY=FOREST/'stage4-whole-hold/v4/terminal-summary.json'
ASSETS=ROOT/'prototypes/place-qa'
PREFIX='native-forest-stage4'
SOURCE_SHA='bcaa5329e2db91398adbf1a56a66ebe2bd9df278d5bc3fafee0b870b356b1d66'
SOURCE_ID='native05-forest-stage4-hold-v1'
sha=lambda b:hashlib.sha256(b).hexdigest()
def dump(p,value):p.write_text(json.dumps(value,indent=2,ensure_ascii=False)+'\n')
def utc():return datetime.now(timezone.utc).isoformat()
def inputs():return {str(p.relative_to(ROOT)):sha(p.read_bytes())for p in [Path(__file__).resolve(),SOURCE,SCOPE,BINDINGS,KIT,SUMMARY]}
def read_glb(path):
 b=path.read_bytes();assert b[:4]==b'glTF';o=12;doc=None;binary=None
 while o<len(b):
  n,k=struct.unpack_from('<II',b,o);chunk=b[o+8:o+8+n];o+=8+n
  if k==0x4e4f534a:doc=json.loads(chunk)
  elif k==0x004e4942:binary=chunk
 assert doc is not None and binary is not None
 return doc,binary

def export_in_blender(out):
 import bpy
 from mathutils import Matrix
 assert sha(SOURCE.read_bytes())==SOURCE_SHA
 bpy.ops.wm.open_mainfile(filepath=str(SOURCE));bpy.context.view_layer.update()
 scope=json.loads(SCOPE.read_text());assert scope['passed']
 identities=scope['originalIdentityToObject'];derived=scope['expectedCreatedObjects']
 assert len(identities)==128 and len(derived)==6
 selected={}
 for identity,name in identities.items():
  owner,node=identity.split(':');obj=bpy.data.objects[name]
  selected[obj]={'ownerId':owner,'roleId':identity,'sourceNode':int(node),'derived':False}
 for name,owner in derived.items():selected[bpy.data.objects[name]]={'ownerId':owner,'roleId':name,'derived':True}
 assert len(selected)==134 and all(o.type=='MESH'for o in selected)
 def matrix(m):return [float(v)for row in m for v in row]
 def fingerprint():
  objects={}
  for obj in bpy.data.objects:
   row={'type':obj.type,'parent':obj.parent.name if obj.parent else None,'world':matrix(obj.matrix_world),'basis':matrix(obj.matrix_basis),'parentInverse':matrix(obj.matrix_parent_inverse)}
   if obj.type=='MESH':
    mesh=obj.data
    row['geometry']=sha(json.dumps({'p':[list(v.co)for v in mesh.vertices],'loops':[v.vertex_index for v in mesh.loops],'polygons':[(p.loop_start,p.loop_total,p.material_index,p.use_smooth)for p in mesh.polygons],'n':[list(n.vector)for n in mesh.corner_normals]},separators=(',',':')).encode())
    row['materials']=[m.name if m else None for m in mesh.materials]
   objects[obj.name]=row
  materials={m.name:{'diffuse':list(m.diffuse_color),'nodes':[(n.name,n.type,[(v.name,list(v.default_value)if hasattr(v.default_value,'__len__')and not isinstance(v.default_value,str)else v.default_value)for v in n.inputs if hasattr(v,'default_value')and isinstance(v.default_value,(int,float,str)) or hasattr(v,'default_value')and hasattr(v.default_value,'__len__')])for n in m.node_tree.nodes]if m.node_tree else []}for m in bpy.data.materials}
  return {'objects':objects,'materials':materials}
 before=fingerprint();source_scene=bpy.context.window.scene
 assert sum(o.type=='MESH'for o in source_scene.objects)==448
 source_rows={}
 def ancestors(objects):
  found=set(objects)
  for obj in list(found):
   parent=obj.parent
   while parent is not None:found.add(parent);parent=parent.parent
  return found
 temp=bpy.data.scenes.new('FOREST DELIVERY ONLY');copies=[]
 try:
  for owner in ['l14','l15','l28','l29']:
   owned=[o for o,row in selected.items()if row['ownerId']==owner]
   chain=ancestors(owned);assert all(o.type!='MESH'or o in owned for o in chain)
   group=bpy.data.objects.new('forest-owner-'+owner,None);group['nativeForestOwner']=owner;temp.collection.objects.link(group)
   mapping={}
   for original in sorted(chain,key=lambda o:o.name):
    copy=original.copy();copy.name='FOREST / '+owner+' / '+original.name
    if copy.type=='MESH':copy.data=original.data.copy()
    temp.collection.objects.link(copy);mapping[original]=copy;copies.append(copy)
   for original,copy in mapping.items():
    copy.parent=mapping.get(original.parent,group)
    copy.matrix_parent_inverse=original.matrix_parent_inverse.copy()if original.parent else Matrix.Identity(4)
    copy.matrix_basis=original.matrix_basis.copy()
    if original in selected:
     tag=selected[original];copy['forestDeliveryOwner']=owner;copy['forestDeliveryId']=tag['roleId'];copy['forestDeliveryDerived']=tag['derived']
     if not tag['derived']:copy['forestDeliverySourceNode']=tag['sourceNode']
     mesh=original.data;mesh.calc_loop_triangles()
     source_rows[tag['roleId']]={'ownerId':owner,'sourceName':original.name,'derived':tag['derived'],'triangles':len(mesh.loop_triangles),'vertices':len(mesh.vertices),'matrixWorldBlender':matrix(original.matrix_world),'sourceLocalPositions':[[float(v)for v in p.co]for p in mesh.vertices]}
   bpy.context.window.scene=temp;bpy.context.view_layer.update()
   for original,copy in mapping.items():
    if copy.type=='MESH':
     source_rows[selected[original]['roleId']]['copyMatrixWorldBlender']=matrix(copy.matrix_world)
  pre_export=fingerprint()
  assert pre_export['objects'].keys() >= before['objects'].keys()
  for name,row in before['objects'].items():assert pre_export['objects'][name]==row,'Original scene changed before export'
  bpy.ops.export_scene.gltf(filepath=str(out/'forest.glb'),export_format='GLB',use_active_scene=True,use_selection=False,
      export_normals=True,export_apply=False,export_yup=True,export_extras=True,export_animations=False,
      export_cameras=False,export_lights=False,export_materials='EXPORT')
  after=fingerprint()
  assert all(after['objects'][name]==row for name,row in before['objects'].items()),'Original object changed during export'
  assert all(after['materials'][name]==row for name,row in before['materials'].items()),'Original material changed during export'
  dump(out/'source-export-proof.json',{'sourceSha256':SOURCE_SHA,'originalObjectCount':len(before['objects']),'originalSceneMeshCount':448,'originalObjectsAndMaterialsExact':True,'selectedOriginalRoles':128,'selectedDerivedBoughs':6,'fixedContextMeshesExported':0,'sourceRows':source_rows,'beforeDigest':sha(json.dumps(before,sort_keys=True).encode()),'precisionStatus':'HOLD from original saved stage4; no new ideal-field geometry PASS','sourceSaved':False})
 finally:bpy.context.window.scene=source_scene


def finish(out,before,result):
 doc,binary=read_glb(out/'forest.glb');nodes=doc['nodes'];owners={o:[]for o in ['l14','l15','l28','l29']}
 allmesh=[n for n in nodes if 'mesh'in n];assert len(allmesh)==134
 ids=[]
 for node in allmesh:
  e=node.get('extras',{});owner=e.get('forestDeliveryOwner');assert owner in owners
  identity=e['forestDeliveryId'];assert identity not in ids;ids.append(identity)
  owners[owner].append(node)
 assert sum(bool(n['extras'].get('forestDeliveryDerived'))for n in allmesh)==6
 assert not doc.get('textures')and not doc.get('images'),'Unexpected texture dependency'
 source=json.loads((out/'source-export-proof.json').read_text());max_matrix_delta=0
 for node in allmesh:
  row=source['sourceRows'][node['extras']['forestDeliveryId']]
  count=sum(doc['accessors'][p['indices']]['count']//3 for p in doc['meshes'][node['mesh']]['primitives'])
  assert count==row['triangles'],('Triangle count changed',row['sourceName'],count,row['triangles'])
  for p in doc['meshes'][node['mesh']]['primitives']:
   assert p.get('mode',4)==4 and 'NORMAL'in p['attributes']and p.get('material')is not None
  max_matrix_delta=max(max_matrix_delta,max(abs(a-b)for a,b in zip(row['matrixWorldBlender'],row['copyMatrixWorldBlender'])))
 raw=(out/'forest.glb').read_bytes();compressed=gzip.compress(raw,compresslevel=9,mtime=0)
 kit=json.loads(KIT.read_text());bindings=json.loads(BINDINGS.read_text());summary=json.loads(SUMMARY.read_text())
 parts=[]
 for owner,items in owners.items():
  binding=bindings['bindings'][owner]
  parts.append({'node':'forest-owner-'+owner,'ownerId':owner,'meshes':len(items),'triangles':sum(source['sourceRows'][n['extras']['forestDeliveryId']]['triangles']for n in items),
   'roles':[{'id':n['extras']['forestDeliveryId'],'derived':bool(n['extras']['forestDeliveryDerived'])}for n in items],
   'binding':{'cell':binding['record']['cell'],'age':binding['age'],'minimumGrowth':18,'sourcePart':binding['species'],'sourcePivot':binding['sourcePivot'],
    'sourceId':kit['candidate'],'sourceSha256':kit['sourceSha256'],'kitExpandedSha256':kit['sha256'],'kitGzipSha256':kit['gzipSha256'],
    'authoredMatrixWorld':binding['authoredTreeMatrixWorld'],'floorWorldId':'native05-authored-world-m0-v2'}})
 artifact={'path':'/prototypes/place-qa/'+PREFIX+'.glb.gz','sha256':sha(compressed),'expandedSha256':sha(raw),'expandedBytes':len(raw),'gzipBytes':len(compressed)}
 manifest={'version':1,'candidate':SOURCE_ID,'source':{'id':SOURCE_ID,'sha256':SOURCE_SHA,'artifact':str(SOURCE.relative_to(ROOT))},'artifact':artifact,'parts':parts,
  'counts':{'nodes':len(nodes),'meshes':134,'primitives':sum(len(doc['meshes'][n['mesh']]['primitives'])for n in allmesh),'triangles':sum(p['triangles']for p in parts),'materials':len(doc['materials']),'originalRoles':128,'derivedBoughs':6},
  'coordinateContract':{'vertices':'Original saved Blender local coordinates exported to glTF Y-up; node hierarchy retains authored-world placement','runtimeTransform':'T(-layout.center, 0, -2) only. Do not apply .45 or age twice.','movable':False,'eligibility':'Exact owner/cell/age/kit/pivot and authored tree matrix match'},
  'status':{'visual':'HOLD','strictWorldGeometryGate':False,'allRoleNormalRoundtrip':'NOT RUN','certifiedContactPass':False,'independentObservers':0,'devCompositionOnly':True,'precisionHolds':summary['precisionHolds'],'maxCopyMatrixComponentDelta':max_matrix_delta},
  'provenance':{'frameRevision':bindings['frameRevision'],'fixedContext':'c1 shoulder35, owner-only; no P02 v5; no context geometry exported','inputs':before,'exportResult':{k:v for k,v in result.items()if k not in ['inputsBefore','inputsAfter']}}}
 (ASSETS/(PREFIX+'.glb.gz')).write_bytes(compressed);dump(ASSETS/(PREFIX+'-manifest.json'),manifest)
 proof={'source':source,'rawGLBMaterials':doc['materials'],'artifact':artifact,'inputHashesBefore':before,'inputHashesAfter':inputs(),'inputsUnchanged':before==inputs(),'scope':'One saved HOLD shape delivery; no source authoring/repair/render; no art/contact/strict-geometry acceptance'}
 # Source positions are observations, not a new geometry profile. Keep raw proof compressed.
 (ASSETS/(PREFIX+'-source-proof.json.gz')).write_bytes(gzip.compress((json.dumps(proof,indent=2)+'\n').encode(),compresslevel=9,mtime=0))
 print(json.dumps({'artifact':artifact,'counts':manifest['counts'],'originalExact':source['originalObjectsAndMaterialsExact'],'maxCopyMatrixDelta':max_matrix_delta}),flush=True)

def main():
 if '--blender-export'in sys.argv:export_in_blender(Path(os.environ['SANSU_FOREST_EXPORT_OUTPUT']));return
 if '--check'in sys.argv:
  m=json.loads((ASSETS/(PREFIX+'-manifest.json')).read_text());b=(ASSETS/(PREFIX+'.glb.gz')).read_bytes();raw=gzip.decompress(b)
  assert sha(b)==m['artifact']['sha256']and sha(raw)==m['artifact']['expandedSha256']
  assert len(b)==m['artifact']['gzipBytes']and len(raw)==m['artifact']['expandedBytes']
  assert sha(SOURCE.read_bytes())==m['source']['sha256'];assert gzip.compress(raw,compresslevel=9,mtime=0)==b
  print('PASS forest saved-source/hash/byte counts/deterministic gzip check');return
 out=Path(os.environ.get('SANSU_FOREST_EXPORT_OUTPUT','/private/tmp/sansu-authored-forest-stage4-delivery/attempt-01'))
 assert not out.exists(),'Preserve first attempt';out.mkdir(parents=True)
 before=inputs();assert before[str(SOURCE.relative_to(ROOT))]==SOURCE_SHA
 command=['/Applications/Blender.app/Contents/MacOS/Blender','-b','--threads','2','--python-exit-code','1','--python',str(Path(__file__).resolve()),'--','--blender-export']
 started=utc();start=time.monotonic();peak=0;stop=None
 with (out/'execution.log.txt').open('xb')as log:
  p=subprocess.Popen(command,stdout=log,stderr=subprocess.STDOUT,start_new_session=True,env=dict(os.environ,SANSU_FOREST_EXPORT_OUTPUT=str(out),OMP_NUM_THREADS='2',OPENBLAS_NUM_THREADS='1'))
  launch={'ownedPid':p.pid,'startedAtUtc':started,'command':command,'threads':2,'rssLimitBytes':3*1024**3,'timeoutSeconds':120};dump(out/'launch.json',launch);print(json.dumps(launch),flush=True)
  try:
   while p.poll()is None:
    rss=subprocess.run(['ps','-o','rss=','-p',str(p.pid)],capture_output=True,text=True).stdout.strip()
    if rss:peak=max(peak,int(rss)*1024)
    if peak>3*1024**3:stop='RSS 3 GiB';break
    if time.monotonic()-start>120:stop='wall 120s';break
    time.sleep(.25)
  finally:
   if p.poll()is None:
    os.killpg(p.pid,signal.SIGTERM)
    try:p.wait(timeout=10)
    except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait()
 try:os.killpg(p.pid,0);gone=False
 except ProcessLookupError:gone=True
 result={**launch,'finishedAtUtc':utc(),'elapsedSeconds':time.monotonic()-start,'exitCode':p.returncode,'stopReason':stop,'peakObservedRssBytes':peak,'ownedProcessGroupGone':gone,'inputsBefore':before,'inputsAfter':inputs(),'sourceInputsUnchanged':before==inputs(),'performanceEvidence':False}
 dump(out/'result.json',result)
 assert not stop and p.returncode==0 and gone and before==inputs(),'Preserved export failure; no automatic retry'
 finish(out,before,result)
if __name__=='__main__':main()
