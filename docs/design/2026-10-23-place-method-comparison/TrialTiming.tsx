import { useEffect, useRef, useState } from 'react';
import { startTrialTiming, stopTrialTiming, trialTimingSnapshot } from './timing-store';

/** Trial-only observer: React updates at explicit start/stop, never per span. */
export function TrialTiming() {
    const [snapshot, setSnapshot] = useState<ReturnType<typeof trialTimingSnapshot> | null>(null);
    const [running, setRunning] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => () => { if (timer.current) { clearTimeout(timer.current); stopTrialTiming(); } }, []);
    const stop = () => {
        if (timer.current) clearTimeout(timer.current); timer.current = null;
        stopTrialTiming(); setSnapshot(trialTimingSnapshot()); setRunning(false);
    };
    const start = () => {
        if (running || !startTrialTiming()) return;
        setSnapshot(null); setRunning(true); timer.current = setTimeout(stop, 10_000);
    };
    return <section aria-label="実験用CPU区間の観測">
        <p>開始後10秒、通常の編集を1回行います。保存データは変更しません。計測自体の微小な負荷を含みます。</p>
        <button type="button" onClick={start} disabled={running}>CPU計測を開始</button>{' '}
        <button type="button" onClick={stop} disabled={!running}>計測を終了</button>
        <p>{running ? '計測中。区間ごとの描画更新はありません。' : '結果の inclusive 時間は入れ子です。合計せず self 時間と親子関係を確認してください。'}</p>
        <pre data-trial-timing style={{ maxHeight: '45vh', overflow: 'auto', fontSize: 10, whiteSpace: 'pre-wrap' }}>{snapshot ? JSON.stringify(snapshot, null, 2) : running ? 'recording' : 'idle'}</pre>
    </section>;
}
