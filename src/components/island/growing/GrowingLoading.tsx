import { useEffect, useState } from 'react';
import { reopenPwaFromNetwork } from '../../../pwa';
import { IslandToyIcon } from '../IslandToyIcon';
import './growingLoading.css';

/**
 * Opening the island in named steps with a percentage. Each step is a real stage (data,
 * learning, the 3D world, the first picture); the number is the step's share, not bytes.
 */
export const LOADING_STEPS = {
    app: { percent: 5, label: 'アプリを よんでいるよ' },
    page: { percent: 10, label: 'しまの じゅんびを しているよ' },
    screen: { percent: 25, label: 'しまの がめんを よんでいるよ' },
    learning: { percent: 40, label: 'まなんだ ぶんを かぞえているよ' },
    saving: { percent: 55, label: 'しまの じかんを すすめているよ' },
    world: { percent: 70, label: 'しまを かいているよ' },
    scene: { percent: 88, label: 'なかまを よんでいるよ' },
} as const;
export type LoadingStep = keyof typeof LOADING_STEPS;

export function GrowingLoading({ step, overlay = false, failed = false, failureDetail, onRetry, onLearn }: {
    step: LoadingStep; overlay?: boolean; failed?: boolean; failureDetail?: string; onRetry?: () => void; onLearn?: () => void;
}) {
    const { percent, label } = LOADING_STEPS[step];
    const [slow, setSlow] = useState(false), [retrying, setRetrying] = useState(false), [notice, setNotice] = useState<string>();
    useEffect(() => {
        setSlow(false); setNotice(undefined);
        if (failed || !['saving', 'world', 'scene'].includes(step)) return;
        const timer = window.setTimeout(() => setSlow(true), 15_000);
        return () => window.clearTimeout(timer);
    }, [step, failed]);
    const reopen = async () => {
        setRetrying(true); setNotice(undefined);
        try { if (!await reopenPwaFromNetwork()) setNotice('ネットにつないで、すこし まってから ためしてね。'); }
        finally { setRetrying(false); }
    };
    return <div className={`growing-loading${overlay ? ' growing-loading--overlay' : ''}`} data-loading-step={step}>
        <div className="growing-loading-card" role={failed ? 'alert' : undefined}>
            <IslandToyIcon kind="island" size={54} />
            <p className="growing-loading-title">{failed ? 'しまの えを ひらけなかったよ' : <>しまを ひらいているよ <strong>{percent}%</strong></>}</p>
            {!failed && <div className="growing-loading-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100}
                aria-valuenow={percent} aria-label={`しまを ひらいているよ ${percent}%`}><span style={{ width: `${percent}%` }} /></div>
            }
            <p className="growing-loading-label">{failed ? 'しまは ほぞんされているよ。かるくして ためしてみよう。' : label}</p>
            {failed && onRetry && <button className="island-primary" onClick={onRetry}>もういちど みる</button>}
            {(slow || failed) && <button className="island-primary" disabled={retrying} onClick={() => void reopen()}>{failed ? '最新版を ひらく' : 'もういちど ひらく'}</button>}
            {failed && onLearn && <button className="island-primary" onClick={onLearn}>まなぶ</button>}
            {failed && failureDetail && <details className="growing-loading-details"><summary>保護者向け：表示エラーの詳細</summary>
                <pre>{`build: ${__BUILD_REVISION__}\n${failureDetail}\n${navigator.userAgent}`}</pre>
            </details>}
            {notice && <p className="growing-loading-label" role="status">{notice}</p>}
        </div>
    </div>;
}
