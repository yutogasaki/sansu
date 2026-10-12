"""Pure GLB world-coordinate check against original Float64 field targets."""
import math
import geometry as g


def node_matrix(node):
    if 'matrix' in node:
        return [[node['matrix'][4*j+i] for j in range(4)] for i in range(4)]
    x,y,z,w=node.get('rotation',[0,0,0,1])
    scale=node.get('scale',[1,1,1]);translation=node.get('translation',[0,0,0])
    rotation=[[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],
              [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],
              [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]]
    return [[rotation[i][j]*scale[j] for j in range(3)]+[translation[i]] for i in range(3)]+[[0,0,0,1]]


def glb_world_report(document,node,attributes,local_blender,targets):
    # One leaf exported from the isolated scene; reject ambiguous parent transforms.
    assert len(document['nodes'])==1 and 'children' not in node
    matrix=node_matrix(node)
    coords=[[p[0],p[2],-p[1]] for p in local_blender]
    actual_positions={tuple(p) for a in attributes for p in a['positions']}
    all_positions_present=all(tuple(p) in actual_positions for p in coords)
    worlds=[g.point(matrix,p) for p in coords]
    errors=[math.dist(a,b) for a,b in zip(worlds,targets)]
    return {'matrix':matrix,'sourceVertexCount':len(coords),'allLocalSourcePositionsPresent':all_positions_present,
            'worlds':worlds,'errorPerVertex':errors,'maxError':max(errors),
            'diagnosticBoundUnchanged':1e-6,'passed':all_positions_present and max(errors)<=1e-6,
            'scope':'Float64 evaluation of emitted GLB TRS; not Float32 GPU nondegeneracy'}
