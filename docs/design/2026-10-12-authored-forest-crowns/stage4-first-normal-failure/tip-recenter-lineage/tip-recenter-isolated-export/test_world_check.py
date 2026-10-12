import unittest
from world_check import node_matrix,glb_world_report


class WorldCheck(unittest.TestCase):
    def test_gltf_matrix_is_column_major(self):
        self.assertEqual(node_matrix({'matrix':[1,0,0,0,0,1,0,0,0,0,1,0,2,3,4,1]}),
                         [[1,0,0,2],[0,1,0,3],[0,0,1,4],[0,0,0,1]])

    def test_axis_basis_and_translated_point(self):
        node={'translation':[4,5,6]}
        result=glb_world_report({'nodes':[node]},node,[{'positions':[[1,3,-2]]}],[[1,2,3]],[[5,8,4]])
        self.assertTrue(result['passed'])
        self.assertEqual(result['maxError'],0)

    def test_world_error_and_missing_vertex_cannot_pass(self):
        node={};doc={'nodes':[node]}
        self.assertFalse(glb_world_report(doc,node,[{'positions':[[1,3,-2]]}],[[1,2,3]],[[1.000002,3,-2]])['passed'])
        self.assertFalse(glb_world_report(doc,node,[{'positions':[[2,3,-2]]}],[[1,2,3]],[[1,3,-2]])['passed'])

    def test_parent_graph_rejected(self):
        with self.assertRaises(AssertionError):
            glb_world_report({'nodes':[{},{}]}, {}, [], [[0,0,0]], [[0,0,0]])
