import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Minus, Plus } from 'lucide-react';
import { createNativeIslandScene, type NativeIslandScene } from './nativeIslandScene';
import { NATIVE_ISLAND_VIEWS, type NativeIslandLight, type NativeIslandView } from './nativeIslandViews';
import { NATIVE_ISLAND_ART_STATES, type NativeIslandArtState } from './nativeIslandArtAssets';
import './nativeIslandArt.css';

/** Explicit development art study: never presents reference figures as earned population. */
export default function NativeIslandArt({ onClose }: { onClose: () => void }) {
    const host = useRef<HTMLDivElement>(null), scene = useRef<NativeIslandScene | undefined>(undefined);
    const [state, setState] = useState<NativeIslandArtState>(() => {
        const requested = new URLSearchParams(window.location.search).get('artStage');
        return requested === 'small' || requested === 'young' ? requested : 'grown';
    });
    const [view, setView] = useState<NativeIslandView>('whole'), [light, setLight] = useState<NativeIslandLight>('day');
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading'), [attempt, setAttempt] = useState(0);
    useEffect(() => {
        const node = host.current; if (!node) return;
        try { scene.current = createNativeIslandScene(node, () => setStatus('ready'), error => { console.error('Native island art', error); setStatus('error'); }, setView, state); }
        catch (error) { console.error('Native island art initialization', error); setStatus('error'); }
        return () => { scene.current?.dispose(); scene.current = undefined; };
    }, [attempt, state]);
    return <section className="native-art-island" data-native-art-study="true" data-art-candidate={NATIVE_ISLAND_ART_STATES[state].candidate} data-art-purpose="whole-island-growth-reference">
        <header className="native-art-heading">
            <div><p>同じ島が育つ、3Dの美術</p><h1>丘と入り江へ育つ島</h1></div>
            <button onClick={onClose}><ArrowLeft size={17} aria-hidden="true" /><span>いまの島へ</span></button>
        </header>
        <nav className="native-art-growth" aria-label="島の成長美術">
            {(Object.keys(NATIVE_ISLAND_ART_STATES) as NativeIslandArtState[]).map(name => <button key={name} aria-pressed={state === name} disabled={status === 'loading'} onClick={() => {
                if (name === state) return;
                setStatus('loading'); setView('whole'); setLight('day'); setState(name);
            }}>{NATIVE_ISLAND_ART_STATES[name].label}</button>)}
        </nav>
        <div className="native-art-stage" ref={host} data-native-art-stage>
            <div className="native-art-light" role="group" aria-label="光の確認">
                {(['day', 'evening'] as const).map(name => <button key={name} aria-pressed={light === name} disabled={status !== 'ready'} onClick={() => { scene.current?.light(name); setLight(name); }}>{name === 'day' ? '昼' : '夕'}</button>)}
            </div>
            <div className="native-art-zoom" role="group" aria-label="島の拡大">
                <button aria-label="拡大" disabled={status !== 'ready'} onClick={() => scene.current?.zoom(1.2)}><Plus size={20} /></button>
                <button aria-label="縮小" disabled={status !== 'ready'} onClick={() => scene.current?.zoom(1 / 1.2)}><Minus size={20} /></button>
            </div>
            {status !== 'ready' && <div className="native-art-status" role={status === 'error' ? 'alert' : 'status'}>
                <p>{status === 'loading' ? '島の3D美術を読み込んでいます…' : '3Dを表示できませんでした。'}</p>
                {status === 'error' && <button onClick={() => { setStatus('loading'); setView('whole'); setLight('day'); setAttempt(value => value + 1); }}>もう一度表示する</button>}
            </div>}
            <nav className="native-art-views" aria-label="島の場所">
                {(Object.keys(NATIVE_ISLAND_VIEWS) as NativeIslandView[]).map(name => <button key={name} aria-pressed={view === name} disabled={status !== 'ready'} onClick={() => scene.current?.view(name)}>{NATIVE_ISLAND_VIEWS[name].label}</button>)}
            </nav>
        </div>
        <footer className="native-art-note">成長の美術見本です。自分の島は「いまの島へ」から戻れます。</footer>
    </section>;
}
