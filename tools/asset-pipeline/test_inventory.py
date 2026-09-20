import tempfile
import unittest
from pathlib import Path
from pipeline import sha, write_json
from inventory import audit


class InventoryTests(unittest.TestCase):
    def test_changed_input_and_over_budget_are_reported_without_mutation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'assets/tree/source/input.png'
            source.parent.mkdir(parents=True)
            source.write_bytes(b'original')
            state = root / 'assets/pipeline/test/state.json'
            write_json(state, {'batch_id': 'test', 'budget_credits': 30, 'reserved_credits': 0,
                              'assets': {'tree': {'status': 'READY', 'source_sha256': sha(source)}}})
            before = state.read_bytes()
            self.assertTrue(audit(root)['pass'])
            source.write_bytes(b'changed')
            self.assertFalse(audit(root)['pass'])
            self.assertEqual(before, state.read_bytes())

    def test_completed_status_alone_is_not_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            write_json(root / 'assets/pipeline/test/state.json', {
                'batch_id': 'test', 'budget_credits': 30, 'reserved_credits': 60,
                'assets': {'tree': {'status': 'VERIFIED', 'reserved_credits': 60}}})
            issues = audit(root)['issues']
            self.assertTrue(any('reservation' in i for i in issues))
            self.assertTrue(any('roundtrip' in i for i in issues))
            self.assertTrue(any('missing source' in i for i in issues))
