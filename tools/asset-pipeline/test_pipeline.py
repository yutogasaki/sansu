import copy
import json
from pathlib import Path
import tempfile
import unittest

from pipeline import initialize, transition, write_json


class CreditGuardTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.recipe = self.root / 'recipe.json'
        self.state = self.root / 'state.json'
        self.spec = {'budget_credits': 30, 'credits_per_asset': 30,
                     'settings': {'ai_model':'meshy-7','model_type':'standard',
                                  'should_texture':True,'enable_pbr':True,
                                  'texture_resolution':'2k','ultra_mode':False,'target_formats':['glb']},
                     'assets':[{'id':'tree','target_height':4,'target_polycount':12000}]}
        self.source = self.root/'assets/tree/source/input.png'
        self.source.parent.mkdir(parents=True)
        self.source.write_bytes(b'approved source fixture')
        write_json(self.recipe, self.spec)

    def init(self):
        initialize(self.recipe,self.root,self.state)

    def test_reservation_survives_crash_before_receipt(self):
        self.init()
        request = transition(self.state,'reserve','tree')
        self.assertEqual(request['arguments']['file_path'],str(self.source.resolve()))
        # Simulate a process dying immediately after its paid request; a new process reads the journal.
        with self.assertRaisesRegex(ValueError,'Do not regenerate'):
            transition(self.state,'reserve','tree')
        self.assertEqual(json.loads(self.state.read_text())['reserved_credits'],30)

    def test_initialize_cannot_reset_spent_budget(self):
        self.init(); transition(self.state,'reserve','tree')
        with self.assertRaisesRegex(ValueError,'already exists'):
            self.init()

    def test_existing_output_requires_new_asset_version(self):
        output = self.root/'assets/tree/meshy_raw/model.glb'
        output.parent.mkdir(parents=True); output.write_bytes(b'existing generation')
        with self.assertRaisesRegex(ValueError, 'already exists'):
            self.init()

    def test_changed_source_is_rejected_before_spending(self):
        self.init(); self.source.write_bytes(b'different source')
        with self.assertRaisesRegex(ValueError,'Source changed'):
            transition(self.state,'reserve','tree')
        self.assertEqual(json.loads(self.state.read_text())['reserved_credits'],0)

    def test_batch_over_budget_is_rejected(self):
        self.spec['assets'].append({'id':'rock','target_height':1,'target_polycount':4000})
        write_json(self.recipe,self.spec)
        with self.assertRaisesRegex(ValueError,'exceeds'):
            self.init()

    def test_runtime_budget_guard(self):
        self.init()
        s=json.loads(self.state.read_text());s['reserved_credits']=30;write_json(self.state,s)
        with self.assertRaisesRegex(ValueError,'exhausted'):
            transition(self.state,'reserve','tree')

    def test_cost_increasing_settings_are_rejected(self):
        for key,value in [('ultra_mode',True),('texture_resolution','8k'),('ai_model','latest')]:
            spec=copy.deepcopy(self.spec);spec['settings'][key]=value;write_json(self.recipe,spec)
            with self.assertRaisesRegex(ValueError,'preset'):
                self.init()

    def test_failed_generation_never_automatically_refunds_reservation(self):
        self.init(); transition(self.state,'reserve','tree')
        tid='11111111-1111-4111-8111-111111111111'
        transition(self.state,'attach','tree',{'task_id':tid})
        transition(self.state,'result','tree',{'task_id':tid,'status':'FAILED','consumed_credits':0})
        with self.assertRaisesRegex(ValueError,'Do not regenerate'):
            transition(self.state,'reserve','tree')
        self.assertEqual(json.loads(self.state.read_text())['reserved_credits'],30)

    def test_wrong_task_receipt_and_unexpected_charge_are_rejected(self):
        self.init(); transition(self.state,'reserve','tree')
        tid='11111111-1111-4111-8111-111111111111'
        transition(self.state,'attach','tree',{'task_id':tid})
        for receipt in [{'task_id':'wrong','status':'SUCCEEDED'},
                        {'task_id':tid,'status':'SUCCEEDED','consumed_credits':35}]:
            with self.assertRaises(ValueError):
                transition(self.state,'result','tree',receipt)


if __name__ == '__main__':
    unittest.main()
