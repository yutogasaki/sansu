"""Pure numerical checks with the immutable source leaf, no Blender execution."""
from pathlib import Path
import gzip
import json
import math
import sys
import unittest
HERE=Path(__file__).resolve().parent;DEBUG=HERE.parent;STAGE=DEBUG.parent
sys.dont_write_bytecode=True;sys.path[:0]=[str(HERE),str(STAGE)]
import geometry as g
import fields


class GeometryTests(unittest.TestCase):
    def test_affine_inverse_and_inverse_transpose_normal(self):
        T=[[2.,0.,0.,4.],[0.,3.,0.,5.],[0.,0.,4.,6.],[0.,0.,0.,1.]]
        self.assertLess(math.dist(g.point(g.inverse(T),g.point(T,[.2,.3,.4])),[.2,.3,.4]),1e-14)
        profile=g.profile([[.2,.3,.4]],[[1.,1.,1.]],T,lambda p:(2*p[0],3*p[1],4*p[2]),tip_vertex=0)
        self.assertLess(math.dist(profile['desiredNormalsByVertex64'][0],g.normalize([.5,1/3,.25])),1e-10)

    def test_identity_field_preserves_source_normal(self):
        T=[[0.,-2.,0.,4.],[2.,0.,0.,5.],[0.,0.,2.,6.],[0.,0.,0.,1.]]
        profile=g.profile([[.2,.3,.4]],[[.6,0.,.8]],T,lambda p:p,tip_vertex=0)
        self.assertLess(math.dist(profile['desiredNormalsByVertex64'][0],[.6,0.,.8]),1e-10)

    def test_folded_field_does_not_pass_existing_determinant_guard(self):
        T=[[float(i==j) for j in range(4)] for i in range(4)]
        with self.assertRaises(AssertionError):
            g.profile([[0.,0.,0.]],[[0.,0.,1.]],T,lambda p:(-p[0],p[1],p[2]),tip_vertex=0)

    def test_source_leaf_precision_and_translation_contract(self):
        raw=json.loads(gzip.decompress((DEBUG/'attempt-01/failing-role-raw.json.gz').read_bytes()))
        source=json.loads(gzip.decompress((DEBUG/'attempt-01/source-role-accessors.json.gz').read_bytes()))['extracted']
        proposal=json.loads((STAGE/'proposal.json').read_text())
        normals=[[n[0],-n[2],n[1]] for n in source['normals']]
        profile=g.profile(raw['inputLocalPositions'],normals,raw['localToWorld'],fields.field_for_role('l14','hanging-leaf',0,proposal))
        keep=[i for i in range(152) if i not in [0,2,98,100]]
        faces=[raw['polygons'][i]['vertices'] for i in keep]
        self.assertEqual([keep[i] for i in g.exact_zero_faces(profile['oldPivot32'],faces)],[45,47,146,150])
        self.assertEqual(g.exact_zero_faces(profile['tipRelative32'],faces),[])
        errors=[math.dist(g.point(profile['compensatedTransform64'],p),q) for p,q in zip(profile['tipRelative32'],profile['targets64'])]
        self.assertLess(max(errors),1e-6)
        self.assertEqual(len(profile['desiredNormalsByVertex64']),78)
        self.assertLess(max(abs(math.sqrt(sum(x*x for x in n))-1) for n in profile['desiredNormalsByVertex64']),1e-14)


if __name__=='__main__':unittest.main(verbosity=2)
