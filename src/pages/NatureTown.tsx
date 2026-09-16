import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Pause, Play, Expand, Home, ArrowLeft, Check, X, Download } from 'lucide-react';
import { useTown } from '../components/natureTown/useTown';
import { TownMap } from '../components/natureTown/TownMap';
import { names, icons } from '../components/natureTown/catalog';
import { useIslandNavigation } from '../components/island/useIslandNavigation';
import type { CellPos, Prop, WorldCommandPayload } from '../domain/natureTown/types';
import { at, key } from '../domain/natureTown/grid';
import { availableHomes } from '../domain/natureTown/life';
import { canOpen } from '../domain/natureTown/commands';
import { balanceUnits, capabilities } from '../domain/natureTown/progress';
import { context } from '../domain/natureTown/world';
import { townDb, decode, type Snapshot } from '../domain/natureTown/repository';
import '../components/natureTown/town.css';
type Tool=Prop['kind']|'path'|'bridge'|'channel'|'erase';
export default function NatureTown() {
    const [restoreFile,setRestoreFile]=useState<Snapshot>(), [restoreError,setRestoreError]=useState('');
    const location=useLocation(), navigation=useIslandNavigation();
    const [pause,setPause]=useState(false), [speed,setSpeed]=useState(1), [tab,setTab]=useState('world'), [overview,setOverview]=useState(false), [overlay,setOverlay]=useState<'none'|'moisture'|'shade'|'traffic'>('none');
    const [tool,setTool]=useState<Tool>(), [selected,setSelected]=useState<CellPos>(), [preview,setPreview]=useState<CellPos[]>([]), [moving,setMoving]=useState<string>(), [undo,setUndo]=useState<WorldCommandPayload>();
    const learning=new URLSearchParams(location.search).has('learn');
    const town=useTown(pause||learning||tab==='records'||!!tool||!!moving,speed,learning), save=town.save;
    if(!save) return <section className="town-loading"><h1>自然と町のしま</h1><p>{town.error||'しまを じゅんびちゅう…'}</p>{town.error&&<><button onClick={()=>void town.recovery()}>前の保存を確認する</button><button onClick={()=>window.location.reload()}>再読み込み</button></>}</section>;
    const w=save.world, caps=capabilities(save.progress), ctx=context(caps);
    const prop=w.props.find(p=>!p.stored&&selected&&key(p.position)===key(selected)), cell=selected?at(w,selected):undefined;
    const toolNames: Record<Tool,string>={...names,path:'道',bridge:'橋',channel:'水路',erase:'道を けす'};
    const cancel=()=>{setPreview([]);setMoving(undefined);setTool(undefined);};
    const select=(p:CellPos)=> {
        setSelected(p);
        if(tool&&['path','bridge','channel','erase'].includes(tool)) {
            setPreview(before=> {
                const next=[...before], from=next[next.length-1]??p; let [x,y]=from;
                while(x!==p[0]) {x+=Math.sign(p[0]-x);next.push([x,y]);}
                while(y!==p[1]) {y+=Math.sign(p[1]-y);next.push([x,y]);}
                if(!next.length)next.push(p);
                return [...new Map(next.map(c=>[key(c),c])).values()];
            });
        } else if(tool||moving) setPreview([p]);
    };
    const confirm=async()=> {
        const position=preview[preview.length-1]; if(!position)return;
        let command: WorldCommandPayload|undefined, inverse: WorldCommandPayload|undefined;
        if(moving) {
            const p=w.props.find(p=>p.id===moving)!;
            command={type:p.stored?'restoreProp':'moveProp',propId:p.id,position,rotation:p.rotation};
            inverse=p.stored?{type:'storeProp',propId:p.id}:{type:'moveProp',propId:p.id,position:p.position,rotation:p.rotation};
        } else if(tool&&tool in names) {
            const id=crypto.randomUUID();command={type:'placeProp',id,kind:tool as Prop['kind'],position,rotation:0};inverse={type:'storeProp',propId:id};
        } else if(tool==='path'||tool==='channel'||tool==='bridge') {
            const fresh=preview.filter(p=>!at(w,p)?.[tool]);
            command={type:tool==='path'?'paintPath':tool==='bridge'?'placeBridge':'paintChannel',cells:preview};inverse={type:'removeOverlay',kind:tool,cells:fresh};
        } else if(tool==='erase') command={type:'removeOverlay',kind:cell?.bridge?'bridge':cell?.channel?'channel':'path',cells:preview};
        if(command) {await town.command(command);setUndo(inverse);cancel();}
    };
    const exportSave=async()=> {
        const row=await townDb.saves.get(w.profileId);if(!row)return;
        const url=URL.createObjectURL(new Blob([JSON.stringify(row,null,2)],{type:'application/json'}));
        const a=document.createElement('a');a.href=url;a.download=`sansu-town-${w.profileId}.json`;a.click();URL.revokeObjectURL(url);
    };
    return <section className="nature-town" data-candidate="nature-town-map-s1" data-tick={w.tick} data-population={w.residents.length}>
        <header className="town-header"><div><span className="town-eyebrow">自然と町 · 試作</span><h1>ふしぎな しま</h1></div><span className="town-weather">{w.weather==='clear'?'☀ はれ':w.weather==='cloud'?'☁ くもり':'☂ あめ'}</span><button onClick={()=>setPause(!pause)} aria-label={pause?'うごかす':'一時停止'}>{pause?<Play/>:<Pause/>}</button></header>
        <div className="town-toolbar"><span>{w.residents.length}人 · {w.chunks.length}/3 地区</span><button onClick={()=>setSpeed(speed===1?2:1)}>{speed}倍</button><button onClick={()=>setOverview(!overview)}><Expand size={16}/>{overview?'近く':'全景'}</button><select aria-label="地図の見え方" value={overlay} onChange={e=>setOverlay(e.target.value as typeof overlay)}><option value="none">いつもの けしき</option><option value="moisture">しめり</option><option value="shade">日かげ</option><option value="traffic">人の通り道</option></select></div>
        {town.error&&<div role="alert" className="town-error">{town.error}<button onClick={()=>window.location.reload()}>再読み込み</button><button onClick={()=>void exportSave()}>データを保管</button><button onClick={()=>void town.recovery()}>前の保存へ戻す</button></div>}
        <TownMap world={w} selected={selected} preview={preview} onCell={select} overview={overview} overlay={overlay}/>
        <div className="town-information" aria-live="polite">{tool||moving?`${moving?'うごかす':toolNames[tool!]}：ばしょを えらんでね。`:(town.notice||'気になる ところを さわってみよう。')}{pause&&' · おやすみちゅう'}</div>
        {(tool||moving)&&<div className="town-confirm"><button onClick={cancel}><X size={18}/>やめる</button><button disabled={!preview.length||!town.ready} onClick={()=>void confirm()}><Check size={18}/>ここにする</button></div>}
        <div className="town-panel">
            {tab==='world'&&<>
                {w.offer?.status==='pending'&&<div className="town-offer"><h2>すんでみたい 旅人が きたよ</h2><p>いつでも むかえられるよ。</p>{availableHomes(w,w.offer.preferredHubId,ctx).map(h=><button key={h.id} onClick={()=>void town.command({type:'acceptSettlement',offerId:w.offer!.id,homeId:h.id})}><Home size={18}/>この家へ むかえる（{h.position.join(',')}）</button>)}</div>}
                {prop?<><h2>{names[prop.kind]}</h2>{prop.kind==='farm'&&<p>{(cell?.moisture??0)>.5?'土が しめっているよ':'土が かわいているよ'} · 育ち {Math.round(prop.growth*100)}% · かご {prop.inventory.food}</p>}{prop.kind==='hub'&&<p>食べもの {prop.inventory.food} · 運んでいる {prop.inventory.incomingReserved}</p>}
                    <div className="town-actions"><button onClick={()=>{setMoving(prop.id);setPreview([]);}}>うごかす</button><button onClick={()=>void town.command({type:'storeProp',propId:prop.id})}>しまう</button>
                    {prop.kind==='hub'&&caps.has('handcart')&&<button onClick={()=>void town.command({type:'setHubTransportPolicy',hubId:prop.id,policy:prop.transportPolicy==='hand'?'cart_if_connected':'hand'})}>{prop.transportPolicy==='hand'?'台車をつかう':'手で はこぶ'}</button>}
                    {prop.kind==='home'&&<select aria-label="家の食たく" value={prop.hubId} onChange={e=>void town.command({type:'assignHomeHub',homeId:prop.id,hubId:e.target.value})}><option value="">食たくを えらぶ</option>{w.props.filter(p=>p.kind==='hub'&&!p.stored).map(h=><option key={h.id} value={h.id}>食たく（{h.position.join(',')}）</option>)}</select>}</div>
                </>:<p>畑・道・木を かえて、くらしを ながめよう。</p>}
                <div className="town-actions">{([[0,1],[1,0]] as CellPos[]).map((p,i)=><button key={key(p)} disabled={!canOpen(w,p,ctx)} onClick={()=>void town.command({type:'openChunk',coordinate:p})}>{i===0?'北':'東'}へ ひろげる</button>)}<button disabled={!undo} onClick={()=>{if(undo)void town.command(undo);setUndo(undefined);}}><ArrowLeft size={16}/>取り消し</button></div>
                <small>{w.chunks.length===3?'この試作で遊べる 3地区が ひらいたよ。':'食たくから 北・東の はしまで 道をつなぐと ひろげられるよ。'}</small>
            </>}
            {tab==='tools'&&<><h2>どうぐを えらぼう</h2><div className="town-tools">{(Object.keys(toolNames) as Tool[]).filter(t=>t!=='channel'||caps.has('irrigation')).map(t=>{const Icon=t in icons?icons[t as Prop['kind']]:null;return <button key={t} aria-pressed={tool===t} onClick={()=>{setTool(t);setMoving(undefined);setPreview([]);}}>{Icon&&<Icon size={22}/>} {toolNames[t]}</button>;})}</div>
                {(['irrigation','handcart'] as const).filter(c=>!caps.has(c)).map(c=><div className="town-unlock" key={c}><p>{c==='irrigation'?'水路 — はなれた 畑に 水をとどける':'台車 — 道をつなぐと 4こずつ はこべる'}</p><button onClick={()=>void town.unlock(c,balanceUnits(save.progress)<3)}>{balanceUnits(save.progress)>=3?'ひらく':`${save.progress.target?.capability===c?'めあてにしたよ':'めあてにする'} · ${Math.min(3,balanceUnits(save.progress))}/3`}</button></div>)}
                {w.props.filter(p=>p.stored).map(p=><button key={p.id} onClick={()=>{setMoving(p.id);setTool(undefined);setPreview([]);}}>{names[p.kind]}を またおく</button>)}
            </>}
            {tab==='records'&&<><h2>きろく と 保存</h2><p>この世界の水や植物は、遊びのための簡単なルールです。</p><button onClick={()=>void exportSave()}><Download size={18}/>保護者用：保存を書き出す</button><label className="town-import">保護者用：書き出した保存を読み込む<input type="file" accept="application/json" onChange={e=>{const file=e.target.files?.[0];if(!file)return;void file.text().then(text=>{const parsed=JSON.parse(text);const snapshot=parsed.current??parsed;decode(snapshot,w.profileId);setRestoreFile(snapshot);setRestoreError('');}).catch(error=>setRestoreError(String(error)));}}/></label>{restoreError&&<p role="alert">{restoreError}</p>}{restoreFile&&<div><p>配置と時間を読み込んだ保存へ戻します。取得済みの道具と学習単位は保持します。</p><button onClick={()=>{void town.restore(restoreFile);setRestoreFile(undefined);}}>この保存から復元する</button><button onClick={()=>setRestoreFile(undefined)}>やめる</button></div>}<p>未使用の学習単位：{balanceUnits(save.progress)}。道具は取得後、何度でも使えます。</p><ol>{w.observations.slice(-8).reverse().map(o=><li key={o.id}>{o.type==='visit'?'花のそばに 小さな虫がきた':o.type==='expansion'?'新しい地区が ひらいた':'新しい出会いがあった'}（{o.position.join(',')}）</li>)}</ol><details><summary>試作の状態</summary><p>tick {w.tick} · 収穫 {w.foodAccounting.harvested} · 共同食 {w.foodAccounting.consumed}</p></details></>}
        </div>
        <nav className="town-nav" aria-label="しまのメニュー"><button aria-pressed={tab==='world'} onClick={()=>{setTab('world');cancel();}}>せかい</button><button aria-pressed={tab==='tools'} onClick={()=>setTab('tools')}>どうぐ</button><button disabled={!town.ready} onClick={()=>{cancel();navigation?.startLearning();}}>れんしゅう</button><button aria-label="きろく と 保存" aria-pressed={tab==='records'} onClick={()=>{setTab('records');cancel();}}>きろく</button></nav>
    </section>;
}
