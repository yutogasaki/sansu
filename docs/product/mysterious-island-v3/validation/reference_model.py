"""Independent v3 specification checks; NOT the application or a production simulator.
Standard library only. Times are hours relative to an arbitrary first study session.
"""
from __future__ import annotations
import json, math
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
ROOT = Path(__file__).resolve().parents[1]
CONFIG = json.loads((ROOT/'data/balance_config.json').read_text())
CATALOG = {x['id']: x for x in json.loads((ROOT/'data/catalog.json').read_text())}


def study_events(amount: int, schedule: str='daily', days: int=180) -> list[tuple[float,int]]:
    if amount < 0 or days < 1 or schedule not in ('daily','mon-wed-fri'):
        raise ValueError('Invalid study scenario')
    return [(24.*d, amount) for d in range(days) if schedule=='daily' or d%7 in (0,2,4)]


def rate(at: float, credits: Iterable[tuple[float,int]]) -> float:
    n=sum(count for time,count in credits if at-24 < time <= at)
    return .5 + .5 * min(n/6, 1)


def grow(start: float, end: float, credits: list[tuple[float,int]]) -> float:
    if end < start:
        raise ValueError('Time must not run backwards')
    boundaries={start,end}
    for time,_ in credits:
        boundaries.update(t for t in (time,time+24) if start<t<end)
    points=sorted(boundaries)
    return sum((b-a)*rate((a+b)/2,credits) for a,b in zip(points,points[1:]))


def maturity_at(start: float, required: float, credits: list[tuple[float,int]]) -> float:
    if required < 0:
        raise ValueError('Negative maturity')
    lo,hi=start,start+required/.5
    for _ in range(60):
        mid=(lo+hi)/2
        if grow(start,mid,credits) >= required: hi=mid
        else: lo=mid
    return hi


class Ledger:
    def __init__(self) -> None:
        self.balance=0
        self.receipts: dict[tuple[str,str,str],int]={}
    def complete(self, profile:str, plan:str, slot:str, outcome:str, *, eligible:bool=True, committed:bool=True) -> int:
        key=(profile,plan,slot)
        if key in self.receipts: return 0
        if not eligible or not committed or outcome not in CONFIG['learning']['eligible_outcomes']: return 0
        self.receipts[key]=2
        self.balance+=2
        return 2


def refund(actual_paid:int) -> int:
    if actual_paid < 0: raise ValueError('Negative price')
    return actual_paid//2


def light_budget(balance:int, owned_styles:int) -> int:
    if balance<0 or not 0<=owned_styles<=2: raise ValueError('Invalid legacy light state')
    return max(0, (2-owned_styles)*4-balance)


@dataclass(frozen=True)
class Plant:
    id:str
    x:int
    z:int
    family:str='flower'
    mature:bool=True


def components(plants:list[Plant], family:str, mature_only:bool=True) -> list[list[Plant]]:
    remaining={ (p.x,p.z):p for p in plants if p.family==family and (p.mature or not mature_only) }
    groups=[]
    while remaining:
        first=min(remaining)
        todo=[first]; group=[]
        while todo:
            cell=todo.pop()
            item=remaining.pop(cell,None)
            if item is None: continue
            group.append(item)
            x,z=cell
            todo.extend((x+dx,z+dz) for dx,dz in ((1,0),(-1,0),(0,1),(0,-1)))
        groups.append(sorted(group,key=lambda p:p.id))
    return groups


def district_state(plants:list[Plant], family:str='flower') -> tuple[bool,bool]:
    groups=components(plants,family)
    base=any(len(g)>=3 for g in groups)
    large=any(len(g)>=6 and max(p.x for p in g)-min(p.x for p in g)+1>=3
              and max(p.z for p in g)-min(p.z for p in g)+1>=2 for g in groups)
    return base,large


def path_distance(start:tuple[int,int], goal:tuple[int,int], walkable:set[tuple[int,int]]) -> int|None:
    if start not in walkable or goal not in walkable: return None
    q=deque([(start,0)]); seen={start}
    while q:
        p,d=q.popleft()
        if p==goal: return d
        for dx,dz in ((1,0),(-1,0),(0,1),(0,-1)):
            n=(p[0]+dx,p[1]+dz)
            if n in walkable and n not in seen:
                seen.add(n);q.append((n,d+1))
    return None


def context_rare(flower_field:bool, water_close:bool) -> bool:
    # X1: eligibility only. Does not prove that the child saw or understood it.
    return flower_field and water_close


def can_record_event(*, preview:bool, source:str, visible_ms:int, core_shown:bool) -> bool:
    return not preview and source in ('live','current-context-test','replay') and visible_ms>=1000 and core_shown


ROUTES={
 'flower_and_bench': {'name':'花1＋ベンチ（配置まで）','buys':['flower','bench'],'mature':[]},
 'flower_bed_and_bench': {'name':'花壇3＋ベンチ','buys':['flower','flower','flower','bench'],'mature':['flower']},
 'four_magic_materials': {'name':'花＋ベンチ＋灯り＋水鉢（4魔法の材料）','buys':['flower','bench','lantern','water-bowl'],'mature':[]},
 'playground_and_wind': {'name':'ブランコ2＋ベンチ＋かざぐるま','buys':['swing','swing','bench','pinwheel'],'mature':[]},
 'grove_and_table': {'name':'成木3＋テーブル','buys':['sapling']*3+['picnic-table'],'mature':['sapling']},
 'flower_field_and_hut': {'name':'花畑6＋ベンチ＋園芸小屋','buys':['flower']*6+['bench','garden-hut'],'mature':['flower']},
 'library_and_bench': {'name':'図書室＋ベンチ','buys':['bench','library'],'mature':[]},
 'mixed_twelve': {'name':'12品種の複合配置例＋土地2回','buys':['flower','bench','flower','flower','sapling','sapling','sapling','swing','swing','water-bowl','water-bowl','land1','lantern','picnic-table','pinwheel','flower','flower','flower','flower-arch','sandbox','land2','garden-hut','library'],'mature':['flower','sapling']},
}
PRICES={id: item['price'] for id,item in CATALOG.items()} | {'land1':12,'land2':24,'land3':48}


def route_result(route_id:str, amount:int, schedule:str='daily') -> dict:
    route=ROUTES[route_id]
    events=study_events(amount,schedule)
    balance=0; purchases=[]; index=0
    for at,count in events:
        balance+=count*2
        while index<len(route['buys']) and balance>=PRICES[route['buys'][index]]:
            id=route['buys'][index];balance-=PRICES[id]
            purchases.append({'kind':id,'at_hours':at,'paid':PRICES[id]})
            index+=1
        if index==len(route['buys']): break
    if index != len(route['buys']): raise ValueError('Simulation horizon too short')
    financed=purchases[-1]['at_hours']
    ready=financed
    for p in purchases:
        if p['kind'] in route['mature']:
            ready=max(ready,maturity_at(p['at_hours'],CATALOG[p['kind']]['mature_effective_hours'],events))
    return dict(route_id=route_id,name=route['name'],schedule=schedule,questions=amount,
                cost=sum(p['paid'] for p in purchases),financed_hours=financed,ready_hours=round(ready,6),
                study_sessions=sum(at<=financed for at,_ in events),purchases=purchases)


def placed(kind:str,x:int,z:int,access:list[tuple[int,int]]|None=None) -> dict:
    return dict(kind=kind,x=x,z=z,access=access)


def layouts() -> dict:
    house={(0,0),(1,0),(0,1)}
    garden=[placed('flower',x,z) for x in (3,4,5) for z in (1,2)] + [placed('bench',3,4,[(3,3)]),placed('garden-hut',0,3,[(2,3)])]
    grove=[placed('sapling',3,1),placed('sapling',4,1),placed('sapling',4,2),placed('picnic-table',2,3,[(2,2),(2,4)])]
    play=[placed('swing',3,2,[(3,3)]),placed('swing',4,2,[(4,3)]),placed('bench',4,4,[(4,3)]),placed('pinwheel',5,1)]
    mixed=[placed('flower',x,z) for x in (3,4,5) for z in (1,2)] + [
        placed('sapling',8,1),placed('sapling',9,1),placed('sapling',8,2),
        placed('swing',3,4,[(3,3)]),placed('swing',4,4,[(4,3)]),
        placed('water-bowl',11,3),placed('water-bowl',11,4),placed('bench',2,2,[(2,3)]),
        placed('library',0,3,[(2,3)]),placed('garden-hut',10,0,[(10,2)]),
        placed('picnic-table',8,4,[(8,3),(9,4)]),placed('lantern',6,4),
        placed('pinwheel',7,4),placed('flower-arch',1,2,[(1,2)]),placed('sandbox',10,3,[(10,2),(10,4)])]
    return { 'garden':([6,5],garden), 'grove':([6,5],grove), 'play':([6,5],play), 'mixed':([12,5],mixed) }


def validate_layout(size:list[int], items:list[dict]) -> dict:
    w,h=size; area={(x,z) for x in range(w) for z in range(h)}
    occupied={(0,0),(1,0),(0,1)}; footprints=[]; passages=set()
    for item in items:
        fw,fh=CATALOG[item['kind']]['footprint']
        cells={(item['x']+dx,item['z']+dz) for dx in range(fw) for dz in range(fh)}
        if not cells <= area: raise AssertionError('Out of bounds')
        if cells & occupied: raise AssertionError('Overlap')
        occupied |= cells;footprints.append(cells)
        if item['kind']=='flower-arch': passages |= cells
    walk=area-occupied|passages
    entry=(1,1)
    for item,foot in zip(items,footprints):
        if item['access']:
            access=set(map(tuple,item['access']))
            # All explicitly reserved role positions must be reachable.
            if not all(path_distance(entry,p,walk) is not None for p in access):
                raise AssertionError(f"Unreachable explicit access: {item}")
        else:
            access={(x+dx,z+dz) for x,z in foot for dx,dz in ((1,0),(-1,0),(0,1),(0,-1))} & walk
            if not any(path_distance(entry,p,walk) is not None for p in access):
                raise AssertionError(f"Unreachable item: {item}")
    return dict(size=size,item_count=len(items),occupied_cells=len(occupied),passable_occupied_cells=len(passages),valid=True,items=items)


def compute() -> dict:
    income=[]
    for schedule in ('daily','mon-wed-fri'):
        for n in (3,6,12,24):
            events=study_events(n,schedule,30)
            income.append(dict(schedule=schedule,questions=n,sessions=len(events),total_questions=n*len(events),drops=2*n*len(events)))
    growth=[]
    for n in (0,3,6,12):
        e=[(0.,n)] if n else []
        growth.append(dict(completions_before_placement=n,flower_hours=round(maturity_at(0,6,e),6),tree_hours=round(maturity_at(0,18,e),6)))
    routes=[route_result(id,n,s) for s in ('daily','mon-wed-fri') for n in (3,6,12) for id in ROUTES]
    return dict(status='independent-spec-model-not-app',catalog_total=sum(x['price'] for x in CATALOG.values()),
                income=income,growth=growth,routes=routes,
                layouts={name:validate_layout(size,items) for name,(size,items) in layouts().items()})


if __name__=='__main__':
    (ROOT/'validation/results.json').write_text(json.dumps(compute(),ensure_ascii=False,indent=2)+'\n')
    print('Wrote validation/results.json. App, 3D assets and user behavior were NOT tested.')
