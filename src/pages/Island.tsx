import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Gift, Leaf, PackageOpen, PawPrint, Settings2 } from 'lucide-react';
import { db } from '../db';
import { getActiveProfile } from '../domain/user/repository';
import type { UserProfile } from '../domain/types';
import { assertIslandPlan, claimIslandReward, openIsland, saveIslandEdit, startIslandPlan } from '../domain/island/repository';
import { parkHissanGrid } from '../domain/park/learning';
import { commitIslandLearning } from '../domain/island/commit';
import { findAvailablePosition, ISLAND_ITEMS, isValidIslandPlacement } from '../domain/island/catalog';
import { ISLAND_DELIVERY_ID, ISLAND_VISUAL_CANDIDATE, ISLAND_LEARNING_CANDIDATE } from '../domain/island/feature';
import type { IslandItem, IslandItemKind, IslandLearningAction, IslandPlan, IslandRecord } from '../domain/island/types';
import { holdPwaUpdateForCriticalPersistence, reachPwaUpdateCheckpoint } from '../pwa';
import { playSound } from '../utils/audio';
import IslandStage from '../components/island/IslandStage';
import { IslandInventory, IslandPlacement, IslandPlay, IslandRewards } from '../components/island/IslandItems';
import { useIslandActions } from '../components/island/useIslandActions';
import { IslandLearningPanel } from '../components/island/IslandLearningPanel';
import { islandFeedbackForReceipt, type IslandLearningFeedback, type IslandReaction } from '../components/island/learningFeedback';
import '../components/park/Park.css';
import '../components/island/Island.css';

type Screen = 'home' | 'learning' | 'reward' | 'inventory' | 'placement' | 'play';

function IslandSession({ profile }: { profile: UserProfile }) {
    const navigate = useNavigate();
    const [snapshot, setSnapshot] = useState<IslandRecord>();
    const live = useLiveQuery(() => db.islands.get(profile.id), [profile.id]);
    const island = live && (!snapshot || live.revision >= snapshot.revision) ? live : snapshot;
    const [plan, setPlan] = useState<IslandPlan>();
    const [screen, setScreen] = useState<Screen>('home');
    const [preview, setPreview] = useState<IslandItem>();
    const [placementSuggestionId, setPlacementSuggestionId] = useState<string>();
    const [playRequest, setPlayRequest] = useState<{ id: string; itemId: string }>();
    const [playMessage, setPlayMessage] = useState<string>();
    const [pulse, setPulse] = useState(0);
    const [reaction, setReaction] = useState<IslandReaction>();
    const [learningFeedback, setLearningFeedback] = useState<IslandLearningFeedback>();
    const [feedback, setFeedback] = useState('');
    const [loadError, setLoadError] = useState(false);
    const { busy, error, run } = useIslandActions();
    useEffect(() => {
        let mounted = true;
        const release = holdPwaUpdateForCriticalPersistence();
        void (async () => {
            const opened = await openIsland(profile.id);
            const pending = opened.pendingPlanId ? await db.islandPlans.get(opened.pendingPlanId) : undefined;
            if (!mounted) return;
            if (opened.pendingPlanId && (!pending || pending.profileId !== profile.id || pending.status !== 'active')) throw new Error('Pending learning unavailable');
            if (pending) assertIslandPlan(pending, profile.id);
            setSnapshot(opened);
            setPlan(pending);
            if (pending) setScreen('learning');
        })().catch(() => { if (mounted) setLoadError(true); }).finally(release);
        return () => { mounted = false; };
    }, [profile.id]);

    const begin = async () => {
        const reserved = await run(() => startIslandPlan(profile.id));
        if (!reserved || reachPwaUpdateCheckpoint('island-learning', { protectNextSession: true })) return;
        setPlan(reserved); setPreview(undefined); setFeedback(''); setLearningFeedback(undefined); setReaction(undefined); setScreen('learning');
    };
    const home = () => {
        if (busy || reachPwaUpdateCheckpoint('island-home', { protectNextSession: true })) return;
        setPreview(undefined); setFeedback(''); setLearningFeedback(undefined); setReaction(undefined); setScreen('home');
    };
    const answer = async (action: IslandLearningAction) => {
        if (!plan || screen !== 'learning') return;
        const receipt = await run(() => commitIslandLearning(profile.id, plan.id, plan.revision, action), 180);
        if (!receipt) return;
        setPlan(receipt.plan); setSnapshot(receipt.island);
        const response = islandFeedbackForReceipt(plan, receipt.plan, receipt.event);
        setLearningFeedback(response?.feedback);
        setReaction(response?.reaction);
        if (response?.reaction?.kind === 'correct') {
            setPulse(value => value + 1);
            if (profile.soundEnabled) playSound('correct');
        }
        if (receipt.plan.status === 'completed') setScreen('reward');
    };
    const select = (item: IslandItem, current = island) => {
        if (!current || busy) return;
        setPlacementSuggestionId(item.position ? undefined : item.id);
        setPreview({ ...item, position: item.position ?? findAvailablePosition(current, item.kind, item.id) ?? { x: 0, z: 1 } });
        setFeedback(''); setScreen('placement');
    };
    const play = (itemId: string) => {
        if (busy || screen !== 'play') return;
        setPlayMessage(undefined);
        setPlayRequest({ id: crypto.randomUUID(), itemId });
    };
    const claim = async (rewardId: string, kind: IslandItemKind) => {
        if (!island) return;
        const updated = await run(() => claimIslandReward(profile.id, island.revision, rewardId, kind));
        if (!updated) return;
        setSnapshot(updated);
        const item = updated.items.find(candidate => candidate.id === `${rewardId}:item`);
        if (item) select(item, updated);
    };
    const place = async (store = false) => {
        if (!island || !preview?.position) return;
        const updated = await run(() => saveIslandEdit(profile.id, island.revision, store
            ? { type: 'store', itemId: preview.id }
            : { type: 'place', itemId: preview.id, position: preview.position!, rotation: preview.rotation }));
        if (!updated) return;
        setSnapshot(updated); setPreview(undefined); setScreen('home');
        setFeedback(store ? 'もちものに とっておくよ' : `${ISLAND_ITEMS[preview.kind].name}を おいたよ`);
    };
    const slot = plan?.slots[plan.cursor];
    const learning = screen === 'learning' && Boolean(slot);
    // Reserve one crop for the entire section, including later diagrams and their help.
    const complex = Boolean(plan?.slots.some(candidate => candidate.problem.inputType === 'multi-number'
        || candidate.problem.questionVisual?.kind === 'operation-base10' || parkHissanGrid(candidate.problem)));
    if (loadError) return <div className="island-loading" role="alert">しまを ひらけなかったよ。<button className="island-primary" onClick={() => window.location.reload()}>もういちど ひらく</button></div>;
    if (!island) return <div className="island-loading" role="status">しまを ひらいているよ…</div>;
    const valid = Boolean(preview?.position && isValidIslandPlacement(island, preview.id, preview.position, preview.rotation));
    const homeTitle = island.completedSets === 0 ? 'ひかりを とどけよう' : island.completedSets < 2 ? 'むこうの にわまで、あとすこし'
        : island.completedSets < 4 ? 'あたらしい ともだちが くるよ' : island.completedSets < 6 ? 'うみを てらす あかりを' : 'どうぶつと ひとやすみ';
    const homeHint = island.completedSets === 0 ? 'ひとつ とくと、しまが ふわっと めをさます。' : island.completedSets < 2 ? 'もうひとくぎりで、はしが つながるよ。'
        : island.completedSets < 4 ? `あと ${4 - island.completedSets} くぎりで、キツネが あそびに くるよ。`
            : island.completedSets < 6 ? `あと ${6 - island.completedSets} くぎりで、とうだいに あかりが ともるよ。` : 'おいた ものを えらんで、いっしょに あそぼう。';
    return <main className="island-page" data-game-id="mystic-island-v1" data-mode={screen} data-complex={Boolean(learning && complex)}
        data-visual-candidate-id={ISLAND_VISUAL_CANDIDATE} data-delivery-id={ISLAND_DELIVERY_ID}
        data-learning-candidate={ISLAND_LEARNING_CANDIDATE}
        data-build-revision={__BUILD_REVISION__} data-build-version={__APP_VERSION__} data-busy={busy}>
        <header className="island-header"><div className="island-brand"><Leaf size={20} /><div><p>{profile.name}の</p><h1>ふしぎな しま</h1></div></div>
            {learning ? <button className="island-text-button island-learning-pause" disabled={busy} onClick={home}>しまへ</button>
                : <button className="island-icon-button" aria-label="せってい" disabled={busy} onClick={() => navigate('/settings')}><Settings2 size={20} /></button>}
        </header>
        {(error || loadError) && <div className="island-error" role="alert"><p>{error}</p><button className="island-text-button" onClick={() => window.location.reload()}>よみなおす</button></div>}
        <IslandStage items={island.items} completedSets={island.completedSets} pulse={pulse} learning={learning}
            reaction={reaction} learningProgress={(learning || screen === 'reward') && plan
                ? { sectionId: plan.id, completed: plan.cursor, total: plan.slots.length } : undefined}
            preview={preview} previewValid={valid} selectedId={screen === 'play' ? playRequest?.itemId : preview?.id}
            placementSuggestionId={screen === 'placement' ? placementSuggestionId : undefined}
            onPlacementSuggestion={({ itemId, position }) => {
                setPreview(previous => previous?.id === itemId ? { ...previous, position } : previous);
                setPlacementSuggestionId(undefined);
            }}
            playRequest={screen === 'play' ? playRequest : undefined}
            onPlayResult={result => {
                if (result.requestId !== playRequest?.id) return;
                setPlayMessage(result.status === 'blocked' ? 'どうぶつが とおれる すきまを あけて みよう。'
                    : result.status === 'unavailable' ? (result.reason === 'renderer' ? '「もういちど みる」で、しまを ひらこう。' : 'もちものから しまに おいて、あそぼう。')
                        : 'ほかの ばしょも えらべるよ。');
            }}
            onGroundPoint={screen === 'placement' && !busy ? point => { setPlacementSuggestionId(undefined); setPreview(previous => {
                if (!previous) return previous;
                const position = { x: Math.round(point.x * 4) / 4, z: Math.round(point.z * 4) / 4 };
                return previous.position?.x === position.x && previous.position?.z === position.z ? previous : { ...previous, position };
            }); } : undefined}
            onItemSelect={!learning && !busy ? id => {
                if (screen === 'play') play(id);
                else { const item = island.items.find(candidate => candidate.id === id); if (item) select(item); }
            } : undefined} />
        {learning && plan ? <IslandLearningPanel plan={plan} busy={busy} feedback={learningFeedback} onAction={action => void answer(action)} />
            : screen === 'reward' && island.pendingRewards.length ? <IslandRewards island={island} disabled={busy} onChoose={(id, kind) => void claim(id, kind)} onContinue={() => void begin()} onClose={home} />
            : screen === 'play' ? <IslandPlay items={island.items} disabled={busy} selectedId={playRequest?.itemId} message={playMessage}
                onSelect={play} onMove={select} onInventory={() => setScreen('inventory')} onContinue={() => void begin()} onClose={home} />
            : screen === 'inventory' ? <IslandInventory items={island.items} disabled={busy} onSelect={select} onClose={home} />
                : screen === 'placement' && preview ? <IslandPlacement item={preview} valid={valid} disabled={busy}
                    onPoint={point => { setPlacementSuggestionId(undefined); setPreview({ ...preview, position: point }); }} onRotate={() => { setPlacementSuggestionId(undefined); setPreview({ ...preview, rotation: preview.rotation + Math.PI / 2 }); }}
                    onSave={() => void place()} onStore={() => void place(true)} onCancel={home} /> : <section className="island-home-controls">
                    <div className="island-home-intro"><p className="island-eyebrow">{island.completedSets === 0 ? 'きょうは、なにが ふえるかな' : 'すこしずつ、じぶんの しまに'}</p>
                        <h2>{homeTitle}</h2><p>{homeHint}</p></div>
                    {feedback && <p className="island-home-feedback" role="status">{feedback}</p>}
                    <button className="island-primary island-start" disabled={busy} onClick={() => void begin()}>{island.pendingPlanId ? 'つづきから とく' : 'ひかりを とどける'}<ArrowRight size={22} /></button>
                    <div className="island-home-secondary"><button className="island-secondary island-play-entry" disabled={busy} onClick={() => {
                        setPlayRequest(undefined); setPlayMessage(undefined); setReaction(undefined); setPreview(undefined); setScreen('play');
                    }}><PawPrint size={20} />どうぶつと あそぶ</button>
                        {island.pendingRewards.length > 0 && <button className="island-secondary" disabled={busy} onClick={() => setScreen('reward')}><Gift size={20} /><span>おくりものを えらぶ<small>{island.pendingRewards.length}こ とどいているよ</small></span></button>}
                        <button className="island-secondary" disabled={busy} onClick={() => setScreen('inventory')}><PackageOpen size={20} />もちもの</button></div>
                    <footer className="island-footer"><span>しまは じどうで のこるよ</span><button className="island-text-button" disabled={busy} onClick={() => navigate('/battle')}>ほかの あそび</button></footer>
                </section>}
    </main>;
}

export default function Island() {
    const [initial, setInitial] = useState<UserProfile | null>();
    const [error, setError] = useState(false);
    const app = useLiveQuery(() => db.appData.get('app'), []);
    const navigate = useNavigate();
    useEffect(() => {
        let mounted = true;
        void getActiveProfile().then(profile => {
            if (!mounted) return;
            if (!profile) navigate('/onboarding', { replace: true });
            setInitial(profile);
        }).catch(() => { if (mounted) setError(true); });
        return () => { mounted = false; };
    }, [navigate]);
    const profile = app ? app.profiles[app.activeProfileId ?? ''] : initial;
    useEffect(() => {
        if (app && !profile) navigate('/onboarding', { replace: true });
    }, [app, profile, navigate]);
    if (error) return <div className="island-loading" role="alert">まだ ひらけなかったよ。<button onClick={() => window.location.reload()}>もういちど</button></div>;
    return profile ? <IslandSession key={profile.id} profile={profile} /> : <div className="island-loading" role="status">しまを ひらいているよ…</div>;
}
