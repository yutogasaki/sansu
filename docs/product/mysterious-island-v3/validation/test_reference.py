"""Tests for this proposal's independent model, not the original application's code."""
import unittest
from reference_model import *

class EconomyTests(unittest.TestCase):
    def test_basic_prices_preserved(self): self.assertEqual([PRICES[x] for x in ['flower','bench','swing','lantern']],[2,4,6,8])
    def test_catalog_total(self): self.assertEqual(sum(x['price'] for x in CATALOG.values()),186)
    def test_daily_income(self): self.assertEqual([sum(n*2 for _,n in study_events(q,days=30)) for q in (3,6,12)],[180,360,720])
    def test_weekly_thirteen_sessions(self): self.assertEqual(len(study_events(6,'mon-wed-fri',30)),13)
    def test_support_same_reward(self):
        l=Ledger()
        self.assertEqual([l.complete('p','a',str(i),o) for i,o in enumerate(CONFIG['learning']['eligible_outcomes'])],[2,2,2])
    def test_duplicate_terminal(self):
        l=Ledger(); l.complete('p','a','0','correct');l.complete('p','a','0','correct');self.assertEqual(l.balance,2)
    def test_invalid_or_uncommitted_no_reward(self):
        l=Ledger()
        for o in ['wrong','skip','partial','play','replay']:
            l.complete('p','a',o,o)
        l.complete('p','a','not-committed','correct',committed=False)
        l.complete('p','a','ineligible','correct',eligible=False)
        self.assertEqual(l.balance,0)
    def test_profile_isolation_key(self):
        l=Ledger();l.complete('a','a','0','correct');l.complete('b','a','0','correct');self.assertEqual(len(l.receipts),2)
    def test_refund_actual_price(self): self.assertEqual(refund(18),9);self.assertEqual(refund(0),0)
    def test_legacy_light_budget(self): self.assertEqual(light_budget(0,0),8);self.assertEqual(light_budget(3,1),1);self.assertEqual(light_budget(1000,0),0)
    def test_finite_light_does_not_refresh(self):
        remaining=light_budget(0,0); granted=min(12,remaining);remaining-=granted
        self.assertEqual(remaining,0);self.assertEqual(min(2,remaining),0)
    def test_no_progress_or_discovery_purchase_gate(self):
        self.assertFalse(CONFIG['learning']['progress_P_enabled'])
        self.assertTrue(all(x['acquisition']['required_progress'] is None and x['acquisition']['required_discovery'] is None for x in CATALOG.values()))

class GrowthTests(unittest.TestCase):
    def test_unstudied_growth(self): self.assertAlmostEqual(maturity_at(0,6,[]),12);self.assertAlmostEqual(maturity_at(0,18,[]),36)
    def test_three_completions(self): self.assertAlmostEqual(maturity_at(0,6,[(0,3)]),8);self.assertAlmostEqual(maturity_at(0,18,[(0,3)]),24)
    def test_six_completions(self): self.assertAlmostEqual(maturity_at(0,6,[(0,6)]),6);self.assertAlmostEqual(maturity_at(0,18,[(0,6)]),18)
    def test_no_extra_boost_after_six(self): self.assertEqual(rate(1,[(0,6)]),rate(1,[(0,12)]))
    def test_boost_expiry_during_growth(self): self.assertAlmostEqual(maturity_at(20,6,[(0,6)]),28)
    def test_storage_interval_excluded(self):
        # Planted [0,2], stored [2,10], planted [10,12]. No growth while stored.
        value=grow(0,2,[])+grow(10,12,[])
        self.assertAlmostEqual(value,2)
    def test_clock_back_rejected(self):
        with self.assertRaises(ValueError): grow(10,9,[])

class DiscoveryTests(unittest.TestCase):
    def setUp(self): self.p=[Plant(str(i),i,1) for i in range(3)]
    def test_group_three(self): self.assertEqual(district_state(self.p),(True,False))
    def test_two_not_three(self): self.assertEqual(district_state(self.p[:2]),(False,False))
    def test_seedling_precursor_not_mature_district(self):
        p=[Plant(str(i),i,1,mature=False) for i in range(3)]
        self.assertEqual(len(components(p,'flower',False)[0]),3);self.assertEqual(district_state(p),(False,False))
    def test_move_and_restore_reversible(self):
        moved=[self.p[0],self.p[1],Plant('2',5,1)]
        self.assertFalse(district_state(moved)[0]);self.assertTrue(district_state(self.p)[0])
    def test_six_in_line_not_field(self): self.assertEqual(district_state([Plant(str(i),i,1) for i in range(6)]),(True,False))
    def test_three_by_two_field(self): self.assertEqual(district_state([Plant(f'{x}-{z}',x,z) for x in range(3) for z in range(2)]),(True,True))
    def test_group_non_consuming(self): before=list(self.p);district_state(self.p);self.assertEqual(self.p,before)
    def test_relation_uses_walkable_path(self):
        walk={(x,z) for x in range(3) for z in range(3)}-{(1,z) for z in range(3)}
        self.assertIsNone(path_distance((0,1),(2,1),walk))
    def test_rare_deterministic(self): self.assertEqual([context_rare(True,True) for _ in range(10)],[True]*10);self.assertFalse(context_rare(True,False))
    def test_preview_not_discovery(self): self.assertFalse(can_record_event(preview=True,source='live',visible_ms=5000,core_shown=True))
    def test_offline_not_observed(self): self.assertFalse(can_record_event(preview=False,source='simulated',visible_ms=5000,core_shown=True))
    def test_short_or_incomplete_not_observed(self):
        self.assertFalse(can_record_event(preview=False,source='live',visible_ms=500,core_shown=True))
        self.assertFalse(can_record_event(preview=False,source='live',visible_ms=2000,core_shown=False))
    def test_presented_not_proof_of_understanding(self):
        self.assertTrue(can_record_event(preview=False,source='live',visible_ms=1200,core_shown=True))
        # The model only yields a rendering eligibility bool; it has no comprehension score.
        self.assertNotIn('comprehension_score',CONFIG['experience'])

class ScenarioTests(unittest.TestCase):
    def test_route_costs(self):
        self.assertEqual(route_result('four_magic_materials',6)['cost'],18)
        self.assertEqual(route_result('mixed_twelve',6)['cost'],250)
    def test_financed_and_ready_differ(self):
        r=route_result('grove_and_table',12)
        self.assertEqual(r['financed_hours'],0);self.assertAlmostEqual(r['ready_hours'],18)
    def test_multiple_layouts(self):
        for size,items in layouts().values(): self.assertTrue(validate_layout(size,items)['valid'])
    def test_invalid_layout_rejected(self):
        with self.assertRaises(AssertionError): validate_layout([6,5],[placed('bench',0,0)])
    def test_magic_not_gated_by_learning(self): self.assertFalse(CONFIG['experience']['magic_progress_gate'])
    def test_complete_compute(self):
        r=compute();self.assertEqual(len(r['routes']),48);self.assertEqual(len(r['layouts']),4)

if __name__=='__main__': unittest.main(verbosity=2)
