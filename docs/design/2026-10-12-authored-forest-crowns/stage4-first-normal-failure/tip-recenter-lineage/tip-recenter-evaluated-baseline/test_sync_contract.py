from pathlib import Path
import gzip,json,unittest
from sync_contract import parent_product32


class SyncContract(unittest.TestCase):
    def setUp(self):
        root=Path(__file__).resolve().parent.parent/'tip-recenter-active-scene/attempt-01'
        self.before=json.loads(gzip.decompress((root/'authoring-scene-before-isolation.json.gz').read_bytes()))['objects']
        self.after=json.loads(gzip.decompress((root/'authoring-scene-after-isolation.json.gz').read_bytes()))['objects']

    def test_saved_two_evaluated_matrices_match(self):
        names=[n for n in self.before if n.startswith('TIP RECENTER DIAGNOSTIC /')]
        self.assertEqual(len(names),2)
        for name in names:
            obj=self.before[name]
            predicted=parent_product32(self.before[obj['parent']]['matrixWorld'],obj['matrixParentInverse'],obj['matrixBasis'])
            self.assertEqual(predicted,self.after[name]['matrixWorld'])
            self.assertNotEqual(predicted,obj['matrixWorld'])

    def test_basis_change_cannot_pass_saved_result(self):
        name='TIP RECENTER DIAGNOSTIC / six-incident-sharp-tip-recenter';obj=self.before[name]
        basis=[r[:] for r in obj['matrixBasis']];basis[0][3]+=.01
        self.assertNotEqual(parent_product32(self.before[obj['parent']]['matrixWorld'],obj['matrixParentInverse'],basis),self.after[name]['matrixWorld'])

    def test_unparented_is_unchanged(self):
        identity=[[float(i==j) for j in range(4)] for i in range(4)]
        self.assertEqual(parent_product32(None,identity,identity),identity)
