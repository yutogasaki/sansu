import unittest
from exact_fingerprint import edge_fingerprint


class Fingerprint(unittest.TestCase):
    def test_generator_is_complete_and_matches_list(self):
        edges=[((1,2),False),((3,4),True)]
        self.assertEqual(edge_fingerprint(edges),edge_fingerprint(x for x in edges))
        self.assertEqual(edge_fingerprint(edges)['count'],2)

    def test_every_flag_and_index_and_order_changes_digest(self):
        original=[((1,2),False),((3,4),True)]
        baseline=edge_fingerprint(original)
        for changed in [[((1,2),True),((3,4),True)], [((1,2),False),((3,5),True)], list(reversed(original)), original[:1]]:
            self.assertNotEqual(baseline,edge_fingerprint(changed))

    def test_invalid_indices_rejected(self):
        with self.assertRaises(AssertionError):
            edge_fingerprint([((1,2,3),False)])
