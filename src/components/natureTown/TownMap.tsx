import { useEffect, useRef } from 'react';
import { Waves, Route, ShoppingBasket, Bug, Footprints } from 'lucide-react';
import type { CellPos, WorldState } from '../../domain/natureTown/types';
import { channelSources } from '../../domain/natureTown/environment';
import { context } from '../../domain/natureTown/world';
import { key } from '../../domain/natureTown/grid';
import LifeResidentPortrait from '../island/life/LifeResidentPortrait';
import { names, icons } from './catalog';
export function TownMap({world,selected,preview,onCell,overview,overlay}:{world:WorldState;selected?:CellPos;preview:CellPos[];onCell:(p:CellPos)=>void;overview:boolean;overlay:'none'|'moisture'|'shade'|'traffic'}) {
    const ref=useRef<HTMLDivElement>(null), side=16, size=overview?27:48;
    const {reached}=channelSources(world,context());
    const visitorHub=world.offer?.status==='pending'?world.props.find(p=>p.id===world.offer?.preferredHubId):undefined;
    const maxX=Math.max(...world.chunks.map(c=>c.coordinate[0]))*side+side, maxY=Math.max(...world.chunks.map(c=>c.coordinate[1]))*side+side;
    useEffect(()=> {if(ref.current){ref.current.scrollLeft=5*48;ref.current.scrollTop=(maxY-11)*48;}},[maxY]);
    return <div className="town-map-scroll" ref={ref} aria-label="しまの地図。スクロールで移動できます">
        <div className="town-map" style={{width:maxX*size,height:maxY*size}} data-testid="town-map">
            {world.chunks.flatMap(ch=>ch.cells).map(c=> {
                const prop=world.props.find(p=>!p.stored&&key(p.position)===key(c.position)), Icon=prop?icons[prop.kind]:null;
                const people=world.residents.filter(r=>key(r.position)===key(c.position)), insects=world.insectVisits.some(v=>key(v.position)===key(c.position));
                const chosen=selected&&key(selected)===key(c.position), pending=preview.some(p=>key(p)===key(c.position));
                const value=overlay==='moisture'?c.moisture:overlay==='shade'?c.shade:Math.min(1,c.traffic/12);
                return <button key={key(c.position)} type="button" className={`town-cell ${c.terrain} ${c.path?'path':''} ${c.bridge?'bridge':''} ${c.channel?'channel':''} ${prop?`prop-${prop.kind}`:''} ${chosen?'selected':''} ${pending?'pending':''}`}
                    style={{left:c.position[0]*size,top:(maxY-c.position[1]-1)*size,width:size,height:size}}
                    onClick={()=>onCell(c.position)} aria-label={`${c.position[0]},${c.position[1]} ${prop?names[prop.kind]:c.bridge?'橋':c.channel?'水路':c.path?'道':c.terrain==='water'?'川':'地面'}`} aria-pressed={!!chosen}>
                    {overlay!=='none'&&<span className={`town-overlay ${overlay}`} style={{opacity:value*.7}}/>}
                    {c.terrain==='water'&&!c.bridge&&<Waves size={20}/>}
                    {c.path&&!prop&&people.length===0&&<Route size={14}/>}
                    {c.channel&&<span className={`town-channel-mark ${reached.has(key(c.position))?'flowing':'dry'}`}>≋</span>}
                    {Icon&&<Icon size={prop?.kind==='tree'?34:27} strokeWidth={1.7}/>}
                    {prop?.kind==='farm'&&<span className="town-growth" style={{width:`${prop.growth*85}%`}}/>}
                    {prop&&'inventory' in prop&&prop.inventory.food>0&&<span className="town-basket"><ShoppingBasket size={12}/>{prop.inventory.food}</span>}
                    {people.slice(0,2).map(r=><span className="town-person" key={r.id} title={r.state==='moving'?'いどうちゅう':r.state==='reacting'?'こんにちは':'ひとやすみ'}>
                        <LifeResidentPortrait resident={r.appearanceRef.endsWith('rabbit')?'rabbit':r.appearanceRef.endsWith('otter')?'otter':'pokomoko'}/>
                        {r.carriedFood>0&&<span className="town-cargo">{r.carriedFood}<ShoppingBasket size={10}/></span>}
                        {r.state==='reacting'&&<span className="town-greeting">♪</span>}
                    </span>)}
                    {people.length>2&&<span className="town-count">{people.length}</span>}
                    {visitorHub&&'entrance' in visitorHub&&key(visitorHub.entrance)===key(c.position)&&<span className="town-person town-visitor" title="すんでみたい旅人"><LifeResidentPortrait resident={world.offer?.templateId==='r5'?'rabbit':world.offer?.templateId==='r6'?'otter':'pokomoko'}/><span className="town-greeting">?</span></span>}
                    {insects&&<Bug className="town-bug" size={15}/>}
                    {overlay==='traffic'&&c.traffic>1&&<Footprints size={14}/>}
                </button>;
            })}
        </div>
    </div>;
}
