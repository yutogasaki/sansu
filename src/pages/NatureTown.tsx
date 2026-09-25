import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Pause, Play, Expand, Home, ArrowLeft, Check, X, Download, Users } from 'lucide-react';
import { useTown } from '../components/natureTown/useTown';
import { TownMap } from '../components/natureTown/TownMap';
import { names, icons } from '../components/natureTown/catalog';
import { useIslandNavigation } from '../components/island/useIslandNavigation';
import type { CellPos, WorldCommandPayload } from '../domain/natureTown/types';
import { connectionMessage, eventMessage, recentEvent, supplyConnections } from '../components/natureTown/livingPresentation';
import { at, key } from '../domain/natureTown/grid';
import { availableHomes } from '../domain/natureTown/life';
import { SettlementStatus } from '../components/natureTown/SettlementStatus';
import { ResidentPanel } from '../components/natureTown/ResidentPanel';
import { residentName } from '../components/natureTown/residentDetails';
import { editIntent, extendStroke, isBrush, type Tool, type OverlayKind } from '../components/natureTown/editing';
import { applyWorldCommand, canOpen } from '../domain/natureTown/commands';
import { balanceUnits, capabilities } from '../domain/natureTown/progress';
import { context } from '../domain/natureTown/world';
import { townDb, decode, type Snapshot } from '../domain/natureTown/repository';
import '../components/natureTown/town.css';
export default function NatureTown() {
    const [restoreFile,setRestoreFile]=useState<Snapshot>(), [restoreError,setRestoreError]=useState('');
    const [residentId,setResidentId]=useState<string>(), [showResidents,setShowResidents]=useState(false);
    const [focus,setFocus]=useState<{position:CellPos;request:number}>(), [brushPan,setBrushPan]=useState(false), [eraseKind,setEraseKind]=useState<OverlayKind>('path');
    const location=useLocation(), navigation=useIslandNavigation();
    const [pause,setPause]=useState(false), [speed,setSpeed]=useState(1), [tab,setTab]=useState('world'), [overview,setOverview]=useState(false), [overlay,setOverlay]=useState<'none'|'moisture'|'shade'|'traffic'>('none');
    const [tool,setTool]=useState<Tool>(), [selected,setSelected]=useState<CellPos>(), [preview,setPreview]=useState<CellPos[]>([]), [moving,setMoving]=useState<string>(), [undo,setUndo]=useState<WorldCommandPayload>();
    const learning=new URLSearchParams(location.search).has('learn');
    const town=useTown(pause||learning||tab==='records'||!!tool||!!moving,speed,learning), save=town.save;
    if(!save) return <section className="town-loading"><h1>自然と町のしま</h1><p>{town.error||'しまを じゅんびちゅう…'}</p>{town.error&&<><button onClick={()=>void town.recovery()}>前の保存を確認する</button><button onClick={()=>window.location.reload()}>再読み込み</button></>}</section>;
    const w=save.world, connections=supplyConnections(w), caps=capabilities(save.progress), ctx=context(caps);
    const prop=w.props.find(p=>!p.stored&&selected&&key(p.position)===key(selected)), cell=selected?at(w,selected):undefined;
    const toolNames: Record<Tool,string>={...names,path:'道',bridge:'橋',channel:'水路',erase:'道を けす'};
    const cancel=()=>{setPreview([]);setMoving(undefined);setTool(undefined);};
    const focusAt=(position:CellPos)=>setFocus(previous=>({position,request:(previous?.request??0)+1}));
    const select=(position:CellPos,connect=true)=> {
        setSelected(position);setResidentId(undefined);
        if(isBrush(tool)) setPreview(before=>extendStroke(before,position,connect));
        else if(tool||moving) setPreview([position]);
    };
    const resident=w.residents.find(r=>r.id===residentId);
    const pickResident=(id:string,locate=false)=> {
        setResidentId(id);setSelected(undefined);setTab('world');setShowResidents(false);cancel();
        const person=w.residents.find(r=>r.id===id);if(locate&&person)focusAt(person.position);
    };
    const chooseTool=(next:Tool)=> {setTool(next);setMoving(undefined);setPreview([]);setResidentId(undefined);setOverview(false);setBrushPan(false);};
    const startMove=(id:string)=> {setMoving(id);setTool(undefined);setPreview([]);setOverview(false);setResidentId(undefined);};
    const intent=editIntent(w,preview,tool,moving,eraseKind);
    const previewError=intent?applyWorldCommand(w,{commandId:'validate-preview',profileId:w.profileId,worldId:w.worldId,expectedRevision:w.revision,payload:intent.payload},ctx).rejection?.childMessage:undefined;
    const confirm=async()=> {
        const next=editIntent(w,preview,tool,moving,eraseKind,crypto.randomUUID());
        if(!next||previewError)return;
        if(await town.command(next.payload)) {setUndo(next.inverse);cancel();}
    };
    const storeSelected=async()=> {
        if(!prop)return;
        if(await town.command({type:'storeProp',propId:prop.id})) {
            setUndo({type:'restoreProp',propId:prop.id,position:prop.position,rotation:prop.rotation});
            setSelected(undefined);
        }
    };
    const exportSave=async()=> {
        const row=await townDb.saves.get(w.profileId);if(!row)return;
        const url=URL.createObjectURL(new Blob([JSON.stringify(row,null,2)],{type:'application/json'}));
        const a=document.createElement('a');a.href=url;a.download=`sansu-town-${w.profileId}.json`;a.click();URL.revokeObjectURL(url);
    };
    return <section className="nature-town" data-candidate="nature-town-ground-a-v1" data-tick={w.tick} data-population={w.residents.length}>
        <header className="town-header"><div><span className="town-eyebrow">自然と町 · 試作</span><h1>ふしぎな しま</h1></div><span className="town-weather">{w.weather==='clear'?'☀ はれ':w.weather==='cloud'?'☁ くもり':'☂ あめ'}</span><button onClick={()=>setPause(!pause)} aria-label={pause?'うごかす':'一時停止'}>{pause?<Play/>:<Pause/>}</button></header>
        <div className="town-toolbar"><span>{w.residents.length}人 · {w.chunks.length}/3 地区</span><button onClick={()=>setSpeed(speed===1?2:1)}>{speed}倍</button><button onClick={()=>setOverview(!overview)} disabled={!!tool||!!moving}><Expand size={16}/>{overview?'近く':'全景'}</button><button aria-pressed={showResidents} onClick={()=>{setShowResidents(!showResidents);setTab('world');cancel();}}><Users size={16}/>住人をさがす</button><select aria-label="地図の見え方" value={overlay} onChange={e=>setOverlay(e.target.value as typeof overlay)}><option value="none">いつもの けしき</option><option value="moisture">しめり</option><option value="shade">日かげ</option><option value="traffic">人の通り道</option></select></div>
        {town.error&&<div role="alert" className="town-error">{town.error}<button onClick={()=>window.location.reload()}>再読み込み</button><button onClick={()=>void exportSave()}>データを保管</button><button onClick={()=>void town.recovery()}>前の保存へ戻す</button></div>}
        <TownMap world={w} events={town.events} connections={connections} selected={selected} preview={preview} onCell={select} overview={overview} overlay={overlay} brush={isBrush(tool)&&!brushPan} panOnly={isBrush(tool)&&brushPan} editing={!!tool||!!moving} invalidPreview={!!previewError} residentId={residentId} onResident={pickResident} focus={focus}/>
        <div className="town-information" aria-live="polite">{previewError??(tool||moving?`${moving?'うごかす':toolNames[tool!]}：ばしょを えらんでね。`:(town.notice||'気になる ところを さわってみよう。'))}{pause&&' · おやすみちゅう'}</div>
        {isBrush(tool)&&<div className="town-brush-mode"><button aria-pressed={!brushPan} onClick={()=>setBrushPan(false)}>なぞる</button><button aria-pressed={brushPan} onClick={()=>setBrushPan(true)}>地図を動かす</button>{tool==='erase'&&<select aria-label="消すもの" value={eraseKind} onChange={e=>{setEraseKind(e.target.value as OverlayKind);setPreview([]);}}><option value="path">道をけす</option><option value="bridge">橋をけす</option><option value="channel">水路をけす</option></select>}</div>}
        {(tool||moving)&&<div className="town-confirm"><button onClick={cancel}><X size={18}/>やめる</button><button disabled={!preview.length||!town.ready||!!previewError} onClick={()=>void confirm()}><Check size={18}/>ここにする</button></div>}
        <div className="town-panel">
            {tab==='world'&&<>
                {showResidents&&<div className="town-resident-list" aria-label="住人の一覧">{w.residents.map(r=><button key={r.id} onClick={()=>pickResident(r.id,true)}>{residentName(w,r)}</button>)}</div>}
                {resident&&<ResidentPanel world={w} resident={resident} event={recentEvent(town.events,resident.id)} onFocus={focusAt} onClose={()=>setResidentId(undefined)}/>}
                {w.offer?.status==='pending'&&<div className="town-offer"><h2>すんでみたい 旅人が きたよ</h2><p>いつでも むかえられるよ。</p>{!availableHomes(w,w.offer.preferredHubId,ctx).length&&<p>食たくに つながる 空いている家を おこう。旅人は あとで むかえられるよ。</p>}{availableHomes(w,w.offer.preferredHubId,ctx).map(h=><button key={h.id} onClick={()=>void town.command({type:'acceptSettlement',offerId:w.offer!.id,homeId:h.id})}><Home size={18}/>この家へ むかえる（{h.position.join(',')}）</button>)}</div>}
                {prop?<><h2>{names[prop.kind]}</h2>{prop.kind==='farm'&&<p>{(cell?.moisture??0)>.5?'土が しめっているよ':'土が かわいているよ'} · 育ち {Math.round(prop.growth*100)}% · かご {prop.inventory.food}</p>}{prop.kind==='hub'&&<p>食べもの {prop.inventory.food} · 運んでいる {prop.inventory.incomingReserved}</p>}
                    {connections.has(prop.id)&&<p className="town-supply-detail">{connectionMessage(connections.get(prop.id))}</p>}{eventMessage(recentEvent(town.events,prop.id),prop.id)&&<p className="town-recent-event">{eventMessage(recentEvent(town.events,prop.id),prop.id)}</p>}
                    {prop.kind==='hub'&&<SettlementStatus world={w} hubId={prop.id} ctx={ctx}/>}
                    <div className="town-actions"><button onClick={()=>startMove(prop.id)}>うごかす</button><button onClick={()=>void storeSelected()}>しまう</button>
                    {prop.kind==='hub'&&caps.has('handcart')&&<button onClick={()=>void town.command({type:'setHubTransportPolicy',hubId:prop.id,policy:prop.transportPolicy==='hand'?'cart_if_connected':'hand'})}>{prop.transportPolicy==='hand'?'台車をつかう':'手で はこぶ'}</button>}
                    {prop.kind==='home'&&<select aria-label="家の食たく" value={prop.hubId} onChange={e=>void town.command({type:'assignHomeHub',homeId:prop.id,hubId:e.target.value})}><option value="">食たくを えらぶ</option>{w.props.filter(p=>p.kind==='hub'&&!p.stored).map(h=><option key={h.id} value={h.id}>食たく（{h.position.join(',')}）</option>)}</select>}</div>
                </>:!resident&&<p>畑・道・木を かえて、くらしを ながめよう。</p>}
                <div className="town-actions">{([[0,1],[1,0]] as CellPos[]).map((p,i)=><button key={key(p)} disabled={!canOpen(w,p,ctx)} onClick={()=>void town.command({type:'openChunk',coordinate:p}).then(applied=>{if(applied)focusAt([p[0]*16+8,p[1]*16+3]);})}>{i===0?'北':'東'}へ ひろげる</button>)}<button disabled={!undo} onClick={()=>{if(undo)void town.command(undo).then(applied=>{if(applied)setUndo(undefined);});}}><ArrowLeft size={16}/>取り消し</button></div>
                <small>{w.chunks.length===3?'この試作で遊べる 3地区が ひらいたよ。':'食たくから 北・東の はしまで 道をつなぐと ひろげられるよ。'}</small>
            </>}
            {tab==='tools'&&<><h2>どうぐを えらぼう</h2><div className="town-tools">{(Object.keys(toolNames) as Tool[]).filter(t=>t!=='channel'||caps.has('irrigation')).map(t=>{const Icon=t in icons?icons[t as keyof typeof icons]:null;return <button key={t} aria-pressed={tool===t} onClick={()=>chooseTool(t)}>{Icon&&<Icon size={22}/>} {toolNames[t]}</button>;})}</div>
                {(['irrigation','handcart'] as const).filter(c=>!caps.has(c)).map(c=><div className="town-unlock" key={c}><p>{c==='irrigation'?'水路 — はなれた 畑に 水をとどける':'台車 — 道をつなぐと 4こずつ はこべる'}</p><button onClick={()=>void town.unlock(c,balanceUnits(save.progress)<3)}>{balanceUnits(save.progress)>=3?'ひらく':`${save.progress.target?.capability===c?'めあてにしたよ':'めあてにする'} · ${Math.min(3,balanceUnits(save.progress))}/3`}</button></div>)}
                {w.props.filter(p=>p.stored).map(p=><button key={p.id} onClick={()=>startMove(p.id)}>{names[p.kind]}を またおく</button>)}
            </>}
            {tab==='records'&&<><h2>きろく と 保存</h2><p>この世界の水や植物は、遊びのための簡単なルールです。</p><button onClick={()=>void exportSave()}><Download size={18}/>保護者用：保存を書き出す</button><label className="town-import">保護者用：書き出した保存を読み込む<input type="file" accept="application/json" onChange={e=>{const file=e.target.files?.[0];if(!file)return;void file.text().then(text=>{const parsed=JSON.parse(text);const snapshot=parsed.current??parsed;decode(snapshot,w.profileId);setRestoreFile(snapshot);setRestoreError('');}).catch(error=>setRestoreError(String(error)));}}/></label>{restoreError&&<p role="alert">{restoreError}</p>}{restoreFile&&<div><p>配置と時間を読み込んだ保存へ戻します。取得済みの道具と学習単位は保持します。</p><button onClick={()=>{void town.restore(restoreFile);setRestoreFile(undefined);}}>この保存から復元する</button><button onClick={()=>setRestoreFile(undefined)}>やめる</button></div>}<p>未使用の学習単位：{balanceUnits(save.progress)}。道具は取得後、何度でも使えます。</p><ol>{w.observations.slice(-8).reverse().map(o=><li key={o.id}>{o.type==='visit'?'花のそばに 小さな虫がきた':o.type==='expansion'?'新しい地区が ひらいた':'新しい出会いがあった'}（{o.position.join(',')}）</li>)}</ol><details><summary>試作の状態</summary><p>tick {w.tick} · 収穫 {w.foodAccounting.harvested} · 共同食 {w.foodAccounting.consumed}</p></details></>}
        </div>
        <nav className="town-nav" aria-label="しまのメニュー"><button aria-pressed={tab==='world'} onClick={()=>{setTab('world');cancel();}}>せかい</button><button aria-pressed={tab==='tools'} onClick={()=>setTab('tools')}>どうぐ</button><button disabled={!town.ready} onClick={()=>{cancel();navigation?.startLearning();}}>れんしゅう</button><button aria-label="きろく と 保存" aria-pressed={tab==='records'} onClick={()=>{setTab('records');cancel();}}>きろく</button></nav>
    </section>;
}
