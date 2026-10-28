import { useState } from 'react';
import type { Command, GrowingState } from '../../../src/domain/growingIsland/types';
import { matureRearrangement, matureTrialEnabled, MATURE_CANDIDATE, type MatureLayout } from './mature-composition';
export function MatureControls({ state, dispatch, occupied }: {state: GrowingState; dispatch:(command: Command)=>Promise<boolean>; occupied:()=>boolean}) {
    const [busy,setBusy]=useState(false), [result,setResult]=useState('A・成熟した持ち物を用意した診断。保存しません。');
    if (!matureTrialEnabled()) return null;
    const arrange=async(layout:MatureLayout)=>{
        if (busy || occupied()) {setResult('回廊などの利用が終わってから切り替えます。'); return;}
        setBusy(true); const started=performance.now(); let count=0, frame=0, last=started, maxGap=0, frames=0;
        const tick=(now:number)=>{maxGap=Math.max(maxGap,now-last);last=now;frames++;frame=requestAnimationFrame(tick);};
        frame=requestAnimationFrame(tick);
        try {
            // Normal domain commands, keeping the same owners and maturity. No fixture reset.
            for(const command of matureRearrangement(state,layout)) {
                if(occupied()) throw Error('利用中の回廊を保護して中断しました。');
                if(!await dispatch(command)) throw Error(`操作拒否 ${command.id}`);
                count++;
                // Allow paint/input between independent commands; this is not a worker.
                await new Promise<void>(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
            }
            setResult(`${layout}・${count}操作・${Math.round(performance.now()-started)}ms・描画${frames}回・最大間隔${Math.round(maxGap)}ms。所有・成熟を保持。`);
        } catch(e) {setResult(String(e));} finally {cancelAnimationFrame(frame);setBusy(false);}
    };
    return <details style={{position:'fixed',top:175,left:8,zIndex:101,background:'#fff',color:'#253248',padding:8,borderRadius:8,maxWidth:330}} data-mature-candidate={MATURE_CANDIDATE}>
        <summary>大樹と水庭の配置比較</summary><p>研究用の通常移動・必要時だけ収納です。途中失敗時は現在地を保持します。</p>
        <button disabled={busy} onClick={()=>void arrange('A')}>配置Aへ</button> <button disabled={busy} onClick={()=>void arrange('B')}>配置Bへ</button><p data-mature-result>{result}</p>
    </details>;
}
