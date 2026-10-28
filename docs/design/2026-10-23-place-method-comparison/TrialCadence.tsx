import { useEffect, useRef, useState } from 'react';
import { candidateId } from './candidate';

const TARGET_MS = 10_000;
const round = (value: number) => Math.round(value * 1000) / 1000;
const EVENT_LIMIT = 40;
interface ClickObservation { atMs: number; tag: string; id: string | null; label: string | null }
interface LongTaskObservation { startMs: number; endMs: number; durationMs: number }
interface SlowFrameObservation { startMs: number; endMs: number; intervalMs: number }

interface CadenceResult {
    status: 'idle' | 'running' | 'completed' | 'interrupted' | 'not-started';
    reason?: 'tab-hidden';
    candidate: string;
    queryCandidate: string;
    targetMs: number;
    startedAt: string | null;
    endedAt: string | null;
    elapsedMs: number;
    samples: number;
    frameCallbacks: number;
    intervalMs: { median: number | null; p95: number | null; max: number | null };
    over50Ms: number;
    visibility: { started: DocumentVisibilityState; ended: DocumentVisibilityState; hiddenObserved: boolean };
    timeline: {
        clock: 'milliseconds-from-measurement-start';
        clicks: ClickObservation[]; clickCount: number;
        longTasks: LongTaskObservation[]; longTaskCount: number;
        longTaskSupport: 'supported' | 'unsupported' | 'observe-failed';
        slowFrames: SlowFrameObservation[];
        retainedLimit: number;
    };
}

interface ActiveRun { dispose: () => void }

function emptyResult(status: CadenceResult['status']): CadenceResult {
    return {
        status, candidate: candidateId(), queryCandidate: new URLSearchParams(location.search).get('terrainTrial') ?? 'A (default)',
        targetMs: TARGET_MS, startedAt: null, endedAt: null, elapsedMs: 0, samples: 0, frameCallbacks: 0,
        intervalMs: { median: null, p95: null, max: null }, over50Ms: 0,
        visibility: { started: document.visibilityState, ended: document.visibilityState, hiddenObserved: false },
        timeline: { clock: 'milliseconds-from-measurement-start', clicks: [], clickCount: 0,
            longTasks: [], longTaskCount: 0, longTaskSupport: 'unsupported', slowFrames: [], retainedLimit: EVENT_LIMIT },
    };
}

/** Local developer observation only. No game state, persistence or geometry access.
 * Frame samples stay in a closure; React updates only at start and finish. */
export function TrialCadence() {
    const [result, setResult] = useState<CadenceResult>(() => emptyResult('idle'));
    const active = useRef<ActiveRun | null>(null);

    useEffect(() => () => { active.current?.dispose(); active.current = null; }, []);

    const start = () => {
        if (active.current) return;
        const initial = emptyResult('running');
        if (document.visibilityState !== 'visible') {
            setResult({ ...initial, status: 'not-started', reason: 'tab-hidden', endedAt: new Date().toISOString(),
                visibility: { ...initial.visibility, hiddenObserved: true } });
            return;
        }
        const started = performance.now();
        initial.startedAt = new Date().toISOString();
        const intervals: number[] = [];
        const clicks: ClickObservation[] = [], longTasks: LongTaskObservation[] = [], slowFrames: SlowFrameObservation[] = [];
        let clickCount = 0, longTaskCount = 0;
        let longTaskSupport: CadenceResult['timeline']['longTaskSupport'] = 'unsupported';
        let longTaskObserver: PerformanceObserver | undefined;
        const collectLongTasks = (entries: PerformanceEntry[]) => {
            for (const entry of entries) {
                if (entry.entryType !== 'longtask' || entry.startTime < started) continue;
                longTaskCount++;
                if (longTasks.length < EVENT_LIMIT) longTasks.push({ startMs: round(entry.startTime - started),
                    endMs: round(entry.startTime + entry.duration - started), durationMs: round(entry.duration) });
            }
        };
        const clickObserved = (event: MouseEvent) => {
            clickCount++;
            if (clicks.length >= EVENT_LIMIT) return;
            const raw = event.target instanceof Element ? event.target : null;
            const target = raw?.closest('button,[role="button"],canvas,a,summary,input,select') ?? raw;
            const text = target?.matches('button,[role="button"],a,summary') ? target.textContent : null;
            const label = target?.getAttribute('aria-label') ?? text;
            clicks.push({ atMs: round(performance.now() - started), tag: target?.tagName.toLowerCase() ?? 'unknown',
                id: target?.id || null, label: label?.replace(/\s+/g, ' ').trim().slice(0, 80) || null });
        };
        if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
            try {
                longTaskObserver = new PerformanceObserver(list => collectLongTasks(list.getEntries()));
                longTaskObserver.observe({ type: 'longtask', buffered: false });
                longTaskSupport = 'supported';
            } catch { longTaskObserver?.disconnect(); longTaskObserver = undefined; longTaskSupport = 'observe-failed'; }
        }
        let frameId = 0, previousFrame: number | undefined, frameCallbacks = 0, disposed = false;
        const dispose = () => {
            disposed = true;
            cancelAnimationFrame(frameId);
            document.removeEventListener('visibilitychange', visibilityChanged);
            document.removeEventListener('click', clickObserved, true);
            longTaskObserver?.disconnect();
        };
        const finish = (hidden: boolean) => {
            if (disposed) return;
            if (longTaskObserver) collectLongTasks(longTaskObserver.takeRecords());
            dispose(); active.current = null;
            const sorted = [...intervals].sort((a, b) => a - b), count = sorted.length;
            const median = count ? count % 2 ? sorted[(count - 1) / 2] : (sorted[count / 2 - 1] + sorted[count / 2]) / 2 : null;
            setResult({ ...initial, status: hidden ? 'interrupted' : 'completed', ...(hidden ? { reason: 'tab-hidden' as const } : {}),
                endedAt: new Date().toISOString(), elapsedMs: round(performance.now() - started), samples: count, frameCallbacks,
                intervalMs: { median: median === null ? null : round(median), p95: count ? round(sorted[Math.ceil(count * .95) - 1]) : null,
                    max: count ? round(sorted[count - 1]) : null },
                over50Ms: intervals.filter(value => value > 50).length,
                visibility: { started: initial.visibility.started, ended: document.visibilityState, hiddenObserved: hidden },
                timeline: { clock: 'milliseconds-from-measurement-start', clicks, clickCount,
                    longTasks, longTaskCount, longTaskSupport, slowFrames, retainedLimit: EVENT_LIMIT } });
        };
        const visibilityChanged = () => { if (document.visibilityState !== 'visible') finish(true); };
        const frame = (timestamp: number) => {
            if (disposed) return;
            if (document.visibilityState !== 'visible') { finish(true); return; }
            frameCallbacks++;
            if (previousFrame !== undefined) {
                const interval = timestamp - previousFrame;
                intervals.push(interval);
                if (interval > 50 && slowFrames.length < EVENT_LIMIT) slowFrames.push({ startMs: round(previousFrame - started),
                    endMs: round(timestamp - started), intervalMs: round(interval) });
            }
            previousFrame = timestamp;
            if (timestamp - started >= TARGET_MS) finish(false);
            else frameId = requestAnimationFrame(frame);
        };
        active.current = { dispose };
        document.addEventListener('visibilitychange', visibilityChanged);
        document.addEventListener('click', clickObserved, { capture: true, passive: true });
        setResult(initial);
        frameId = requestAnimationFrame(frame);
    };

    if (!new URLSearchParams(location.search).has('trialEvidence')) return null;
    const running = result.status === 'running';
    const statusText = running ? '計測中。タブを表示したまま約10秒待ちます。'
        : result.status === 'completed' ? '計測完了。タブは計測中に非表示になっていません。'
            : result.status === 'interrupted' ? 'タブが非表示になったため中断しました。下記は中断までの標本です。'
                : result.status === 'not-started' ? '非表示のタブでは開始しません。表示してから開始してください。'
                    : 'ボタンを押すまで計測しません。';
    return <section aria-label="実験用フレーム間隔の観測" style={{ borderTop: '1px solid #c8d0d9', paddingTop: 8, marginTop: 8 }}>
        <p style={{ margin: '4px 0' }}>実験用・フレーム間隔：{result.queryCandidate}</p>
        <button type="button" onClick={start} disabled={running} style={{ padding: '7px 10px' }}>
            {running ? '計測中…' : '10秒の計測を開始'}
        </button>
        <p role="status" style={{ margin: '6px 0' }}>{statusText}</p>
        <p style={{ margin: '6px 0', fontSize: 11 }}>rAF間隔の傾向を観測します。GPU描画時間・実機性能・快適さの合格を示しません。</p>
        <p style={{ margin: '6px 0', fontSize: 11 }}>計測中のクリック先・長い処理・長いフレーム間隔を同じ時刻軸で記録します。入力値は読み取りません。時刻の重なりだけで原因を断定しません。</p>
        <pre data-trial-cadence style={{ maxHeight: 210, overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: 10 }}>
            {JSON.stringify(result, null, 2)}
        </pre>
    </section>;
}
