"""Read-only native scene check; run against the saved .blend, not builder memory."""
import bpy, json, hashlib
from pathlib import Path
from mathutils import Vector

root=Path(__file__).resolve().parent
scene=bpy.context.scene
assert scene.get('visual_candidate')=='whole-island-native-3d-05'
assert scene.render.engine=='CYCLES'
assert scene.camera is not None
curves=[o for o in scene.objects if o.type=='CURVE']
walls=[o for o in scene.objects if o.name.endswith('/ rounded walls')]
assert len(curves)>100, 'The native model must retain editable curves.'
assert len(walls)==15
terrain=bpy.data.objects['Island / continuous sculpted mature terrain']
assert terrain.type=='MESH' and len(terrain.data.vertices)>3000
assert max(v.co.z for v in terrain.data.vertices)>5.5
assert scene['growth_area_ratio']>1.8
trunk=bpy.data.objects['Grove / great root house trunk']
assert trunk.type=='MESH' and trunk.get('habitable_cavity')
floor=bpy.data.objects['Grove / hollow dwelling floor']
origin=floor.location+Vector((0,-3,1))
ok,co,normal,index=trunk.ray_cast(origin,Vector((0,1,0)))
assert ok and co.y>floor.location.y+.1, 'The entry must actually open inside the trunk, not be a door on solid bark.'
assert bpy.data.objects.get('Grove / continuous bough gallery')
assert any(o.name.startswith('Grove / broad silver fan leaf') for o in scene.objects)
leaves=[o for o in scene.objects if o.name.startswith('Grove / broad silver fan leaf')]
assert len(leaves)==12 and all(o.data.color_attributes.get('Living leaf colour') for o in leaves)
grotto=bpy.data.objects['Hill / grown mineral headwater grotto']
assert grotto.get('water_source_role') and grotto.type=='MESH'
assert bpy.data.objects.get('Inlet / mineral headwater feed')
basins=[bpy.data.objects['Hill / open water terrace '+str(i)] for i in (1,2,3)]
levels=[o['water_level'] for o in basins]
assert levels[0]>levels[1]>levels[2]>2.34
assert all(o.get('open_retaining_bowl') for o in basins)
pools=[bpy.data.objects['Ocean / joined terrace pool '+str(i)] for i in (1,2,3)]
assert all(o.type=='MESH' and o.data.color_attributes.get('Spring depth colour') for o in pools)
for (cx,cy,rx,ry),level in zip([(4.35,18.2,1.48,1.42),(2.55,15.95,1.66,1.26),(.95,13.15,1.78,1.19)],levels):
    for dx,dy in [(0,0),(.6,0),(-.6,0),(0,.6),(0,-.6)]:
        hit,point,normal,index=terrain.ray_cast(Vector((cx+rx*dx,cy+ry*dy,30)),Vector((0,0,-1)))
        assert hit and point.z<level-.08, 'Dry terrain must not poke through a terrace pool.'
assert all(bpy.data.objects.get('Inlet / terrace connecting fall '+str(i)).get('continuous_flow_sheet') for i in (1,2,3))
shell=bpy.data.objects['Harbor / continuous translucent shell hall']
shell_bsdf=next(n for n in shell.data.materials[0].node_tree.nodes if n.type=='BSDF_PRINCIPLED')
assert shell_bsdf.inputs['Transmission Weight'].default_value>.3
assert bpy.data.objects.get('Hill / blue terrace home / broad scalloped cap roof')
assert bpy.data.objects.get('Harbor / peninsula home / folded leaf roof')
assert not bpy.data.objects.get('Harbor / joined petal shelter')
assert any(o.name.startswith('Grove / spire tree') for o in scene.objects)
assert any(o.name.startswith('Grove / silver birch') for o in scene.objects)
assert bpy.data.objects.get('Whole island / grown living arch').type=='CURVE'
assert bpy.data.objects.get('Island / living spring bank').type=='CURVE'
assert len(bpy.data.objects['Island / living spring bank'].data.splines)==2, 'The upper pool must cut through its grass cap.'
assert sum(o.name.startswith('Inlet / continuous spring waterfall') for o in scene.objects)==7
assert bpy.data.objects.get('Ocean / tide and reflected sky').data.color_attributes.get('Tide color')
assert any(o.name.startswith('Flowers / shared giant petal canopy') for o in scene.objects)
assert len([c for c in scene.collection.children if c.name[:2].isdigit()])==7
textures=[im for im in bpy.data.images if im.name.startswith('resident-texture-')]
assert len(textures)==2 and all(im.packed_file for im in textures), 'Original fabric must travel with the native file.'
report={
 'result':'PASS', 'candidate':scene['visual_candidate'],
 'evidence':'reopened saved native .blend; not builder memory',
 'blender_version':bpy.app.version_string, 'objects':len(scene.objects),
 'editable_curves':len(curves), 'houses':len(walls),
 'collections':[c.name for c in scene.collection.children if c.name[:2].isdigit()],
 'packed_resident_textures':len(textures), 'spring_cutout':True, 'connected_waterfall_strands':7, 'depth_colored_water':True,
 'sculpted_terrain_vertices':len(terrain.data.vertices), 'terrain_max_height':max(v.co.z for v in terrain.data.vertices),
 'terrain_height_range':[min(v.co.z for v in terrain.data.vertices),max(v.co.z for v in terrain.data.vertices)],
 'growth_area_ratio':scene['growth_area_ratio'], 'original_home_centers':{o.name:list(o.location) for o in walls if not o.name.startswith(('Hill /','Harbor /'))},
 'hollow_trunk_entry_ray':'PASS', 'joined_water_terrace_levels':levels,
 'water_terraces_clear_of_dry_land':'PASS',
 'living_leaf_colours':len(leaves), 'mineral_headwater_grotto':True, 'blue_depth_coloured_terraces':len(pools),
 'translucent_shell_transmission':shell_bsdf.inputs['Transmission Weight'].default_value,
 'new_home_outlines':['round scalloped cap','folded leaf roof'],
 'native_sha256':hashlib.sha256((root/'whole-island.blend').read_bytes()).hexdigest(),
 'game_runtime':'NOT_EVALUATED', 'visual_adoption':'NOT_APPROVED_BY_USER'
}
(root/'native-check.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report),flush=True)
