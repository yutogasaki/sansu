import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import GrowingWorld from '../../components/island/growing/GrowingWorld';
import { parsePlacePack, type PlacePack } from './pack';
import './expansion.css';

const directions = [{ id: 'bay', name: '入り江を抱く島', detail: '東西へ伸びる岸が、水面を囲む。' },
    { id: 'forest', name: '森の回廊が伸びる島', detail: '片側へ続く枝と樹冠に、集落が沿う。' },
    { id: 'garden', name: '丘と庭が連なる島', detail: '奥へ伸びる低い丘と、庭のまとまり。' }] as const;
function Showcase({ pack }: { pack: PlacePack }) {
    const [direction, setDirection] = useState<(typeof directions)[number]['id']>('bay');
    const [size, setSize] = useState<8 | 16 | 32>(16), [time, setTime] = useState<'day' | 'dusk'>('day');
    const [turn, setTurn] = useState(0), [reset, setReset] = useState(0), [stage, setStage] = useState('scene');
    const [focus, setFocus] = useState<{ id: string; n: number }>();
    const entry = pack.cases.find(item => size === 8 ? item.id === 'qa-place-whole-island-v1' : item.expansion?.direction === direction && item.expansion.size === size)!;
    const plan = directions.find(item => item.id === direction)!;
    const viewKey = `${entry.id}:${reset}`;
    const choose = (id?: string) => { if (id) setFocus(previous => ({ id, n: (previous?.n ?? 0) + 1 })); };
    return <div className="expansion-showcase" data-expansion-case={entry.id} data-build-revision={__BUILD_REVISION__}>
        <header><div><p>実3D · 広がる島</p><h1>{plan.name}</h1><span>{plan.detail}</span></div>
            <a href="/prototypes/place-qa/">配置・保存を確認</a></header>
        <nav aria-label="島の広がり方">{directions.map(item => <button key={item.id} aria-pressed={direction === item.id} onClick={() => { if (size !== 8 && direction !== item.id) setStage('scene'); setDirection(item.id); setFocus(undefined); }}>{item.name}</button>)}</nav>
        <main>
            <GrowingWorld key={viewKey} state={entry.island.state} time={time} turn={turn} cheer={0} festival={0} focus={focus}
                onCell={() => {}} onSelect={choose} onOpen={() => {}} onDisembark={() => {}} onActorTap={choose}
                onStage={setStage} onFailure={() => setStage('failed')} />
            {stage !== 'ready' && <p className="expansion-status" role="status">{stage === 'failed' ? '表示を読み直してください。' : '島を描いています…'}</p>}
            <div className="expansion-controls"><div role="group" aria-label="島の大きさ">{([8, 16, 32] as const).map(count => <button key={count} aria-pressed={size === count} onClick={() => { if (size !== count) setStage('scene'); setSize(count); setFocus(undefined); }}>{count === 8 ? '元の8軒' : `${count}軒`}</button>)}</div>
                <div role="group" aria-label="光">{(['day', 'dusk'] as const).map(light => <button key={light} aria-pressed={time === light} onClick={() => setTime(light)}>{light === 'day' ? '昼' : '夕'}</button>)}</div>
                <div role="group" aria-label="視点"><button aria-label="左へ回す" onClick={() => setTurn(turn - 1)}>↶</button><button onClick={() => { setReset(reset + 1); setFocus(undefined); }}>全景</button><button aria-label="右へ回す" onClick={() => setTurn(turn + 1)}>↷</button></div>
            </div>
            <p className="expansion-gesture">ドラッグで見回す · ピンチで拡大 · 家や木を選ぶと近づく</p>
        </main>
        <footer><p>同じ材料と成熟で三方向を比較。元の家と植物の所有ID・位置・屋根色を保持しています。</p>
            <small>明示した診断保存 · 本体と同じ3D描画 · 学習や取得の実績にはしません · {__BUILD_REVISION__}</small></footer>
    </div>;
}
const root = createRoot(document.getElementById('app')!);
if (!import.meta.env.DEV) root.render(<p>この比較は開発環境で開いてください。</p>);
else void fetch('/prototypes/place-qa/expansion-fixtures.json', { cache: 'no-store' }).then(response => {
    if (!response.ok) throw new Error('比較の診断保存がありません。'); return response.text();
}).then(parsePlacePack).then(pack => root.render(<Showcase pack={pack} />)).catch(error => root.render(<p role="alert">{String(error)}</p>));
