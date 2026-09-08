import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Gift, Leaf, PackageOpen, PawPrint, Settings2, Sparkles } from 'lucide-react';
import { db } from '../db';
import { getActiveProfile } from '../domain/user/repository';
import type { UserProfile } from '../domain/types';
import { assertIslandPlan, claimIslandReward, openIsland, saveIslandEdit, startIslandPlan } from '../domain/island/repository';
import { parkHissanGrid } from '../domain/park/learning';
import { islandObservationBinding } from '../domain/island/learningObservation';
import { useIslandLearningObservation, type IslandLearningRequest } from '../components/island/useIslandLearningObservation';
import { commitIslandLearningSession, isFirstIslandPlan } from '../domain/island/learningSession';
import { setIslandNextSubject } from '../domain/island/subjectPreference';
import { findAvailablePosition, ISLAND_ITEMS, isValidIslandPlacement } from '../domain/island/catalog';
import { ISLAND_DELIVERY_ID, ISLAND_VISUAL_CANDIDATE, ISLAND_LEARNING_CANDIDATE } from '../domain/island/feature';
import type { IslandHabitatId, IslandItem, IslandItemKind, IslandLearningAction, IslandPlan, IslandRecord } from '../domain/island/types';
import { selectIslandGrowthTarget, setIslandItemAppearance } from '../domain/island/growthRepository';
import { holdPwaUpdateForCriticalPersistence, reachPwaUpdateCheckpoint } from '../pwa';
import { playSound, setSoundEnabled } from '../utils/audio';
import IslandStage from '../components/island/IslandStage';
import { IslandInventory, IslandPlacement, IslandPlay, IslandRewards } from '../components/island/IslandItems';
import { useIslandActions } from '../components/island/useIslandActions';
import { useIslandDiscoveries } from '../components/island/useIslandDiscoveries';
import { IslandDistricts, IslandGrowthChoices, IslandGrowthSummary, type IslandDistrict } from '../components/island/IslandGrowth';
import { IslandAlbum } from '../components/island/IslandAlbum';
import { getIslandGrowthMilestone } from '../domain/island/growth';
import { IslandMilestoneNotice, IslandMilestoneReturn, type IslandMilestone } from '../components/island/IslandMilestone';
import { IslandLearningPanel } from '../components/island/IslandLearningPanel';
import { islandFeedbackForReceipt, type IslandLearningFeedback, type IslandReaction } from '../components/island/learningFeedback';
import { getIslandCosmetics } from '../domain/island/customization';
import { IslandCustomization, IslandCustomizationGoal, IslandCustomizationPreviewNotice } from '../components/island/IslandCustomization';
import { useIslandCustomization } from '../components/island/useIslandCustomization';
import { IslandStarReceipt } from '../components/island/IslandStarReceipt';
import { islandStarReceipt } from '../components/island/islandStarReceiptEligibility';
import '../components/park/Park.css';
import '../components/island/Island.css';

type Screen = 'home' | 'learning' | 'reward' | 'inventory' | 'placement' | 'play' | 'growth' | 'album' | 'customization';
const RENDERER_RECOVERY_HINT = '「もういちど みる」で、しまを ひらこう。';

function sharingHint(items: IslandItem[], selectedId: string) {
    const selected = items.find(item => item.id === selectedId);
    if (!selected) return undefined;
    const pair = [
        { kinds: ['flower', 'bench'], hint: 'ベンチの まえに おはなを おくと…？' },
        { kinds: ['lantern', 'mushroom'], hint: 'きのこの いすの まえに あかりを おくと…？' },
        { kinds: ['fountain', 'swing'], hint: 'ブランコの まえに ふんすいを おくと…？' },
    ].find(pair => pair.kinds.includes(selected.kind) && pair.kinds.every(kind => items.some(item => item.kind === kind)));
    return pair?.hint;
}

function IslandSession({ profile }: { profile: UserProfile }) {
    const navigate = useNavigate();
    const location = useLocation();
    const [entry] = useState(() => {
        const query = new URLSearchParams(location.search);
        const requested = query.get('start') === 'learn';
        const target = query.get('profile');
        query.delete('start'); query.delete('profile');
        return { requested, start: requested && (!target || target === profile.id),
            cleanUrl: `${location.pathname}${query.size ? `?${query}` : ''}${location.hash}` };
    });
    const entryCleared = useRef(false);
    const [opening, setOpening] = useState(true);
    const [nextPlanError, setNextPlanError] = useState(false);
    const [snapshot, setSnapshot] = useState<IslandRecord>();
    const live = useLiveQuery(() => db.islands.get(profile.id), [profile.id]);
    const island = live && (!snapshot || live.revision >= snapshot.revision) ? live : snapshot;
    const [plan, setPlan] = useState<IslandPlan>();
    const [screen, setScreen] = useState<Screen>('home');
    const [preview, setPreview] = useState<IslandItem>();
    const [placementSuggestionId, setPlacementSuggestionId] = useState<string>();
    const [playRequest, setPlayRequest] = useState<{ id: string; itemId: string; discoveryId?: string }>();
    const [district, setDistrict] = useState<IslandDistrict>('all');
    const [latestMilestone, setLatestMilestone] = useState<IslandMilestone>();
    const [starReceipt, setStarReceipt] = useState<string>();
    const lastStarReceipt = useRef<string | undefined>(undefined);
    const [albumComparison, setAlbumComparison] = useState<IslandHabitatId | 'all'>('garden');
    const [playMessage, setPlayMessage] = useState<string>();
    const [pulse, setPulse] = useState(0);
    const [reaction, setReaction] = useState<IslandReaction & { growthTarget?: IslandHabitatId }>();
    const [learningFeedback, setLearningFeedback] = useState<IslandLearningFeedback>();
    const [feedback, setFeedback] = useState('');
    const [loadError, setLoadError] = useState(false);
    const { busy, busyKind, error, run } = useIslandActions();
    const comparisonDisabled = busy && busyKind !== 'discovery';
    const customization = useIslandCustomization(island, run, setSnapshot);
    const discoveries = useIslandDiscoveries({ profileId: profile.id, island, enabled: screen === 'home' || screen === 'play', busy, run, onSaved: setSnapshot });
    const observation = useIslandLearningObservation();
    useEffect(() => { setSoundEnabled(profile.soundEnabled); }, [profile.soundEnabled]);
    useEffect(() => {
        let mounted = true;
        const release = holdPwaUpdateForCriticalPersistence();
        void (async () => {
            const opened = await openIsland(profile.id);
            const pending = opened.pendingPlanId ? await db.islandPlans.get(opened.pendingPlanId) : undefined;
            if (!mounted) return;
            if (opened.pendingPlanId && (!pending || pending.profileId !== profile.id || pending.status !== 'active')) throw new Error('Pending learning unavailable');
            if (pending) assertIslandPlan(pending, profile.id);
            let reserved = pending;
            if (entry.start && !reserved) {
                try { reserved = await startIslandPlan(profile.id); }
                catch { if (mounted) setNextPlanError(true); }
            }
            if (!mounted) return;
            setSnapshot(opened);
            setPlan(reserved);
            if (reserved || entry.start) setScreen('learning');
            if (entry.requested && (reserved || !entry.start)) {
                entryCleared.current = true;
                navigate(entry.cleanUrl, { replace: true });
            }
        })().catch(() => { if (mounted) setLoadError(true); }).finally(() => {
            release();
            if (mounted) setOpening(false);
        });
        return () => { mounted = false; };
    }, [profile.id, entry, navigate]);

    const clearEntry = () => {
        if (!entry.requested || entryCleared.current) return;
        entryCleared.current = true;
        navigate(entry.cleanUrl, { replace: true });
    };

    const begin = async () => {
        const reserved = await run(() => startIslandPlan(profile.id));
        if (!reserved || reachPwaUpdateCheckpoint('island-learning', { protectNextSession: true })) return;
        clearEntry(); setNextPlanError(false);
        customization.reset();
        setStarReceipt(undefined);
        if (screen !== 'learning') setLatestMilestone(undefined);
        setPlan(reserved); setPreview(undefined); setFeedback(''); setLearningFeedback(undefined); setReaction(undefined); setScreen('learning');
    };
    const home = () => {
        if ((busy && !(screen === 'album' && busyKind === 'discovery'))
            || reachPwaUpdateCheckpoint('island-home', { protectNextSession: true })) return;
        clearEntry(); setNextPlanError(false);
        discoveries.revisit();
        customization.reset();
        setStarReceipt(undefined);
        setPreview(undefined); setFeedback(''); setLearningFeedback(undefined); setReaction(undefined); setScreen('home');
    };
    const answer = async (action: IslandLearningAction) => {
        if (!plan || screen !== 'learning') return;
        let request: IslandLearningRequest | undefined;
        const result = await run(() => {
            request = observation.request(islandObservationBinding(plan), action);
            return commitIslandLearningSession(profile.id, plan.id, plan.revision, request.action, db, request.observation);
        }, 180);
        if (!result) return;
        const { receipt, nextPlan, latestIsland } = result;
        observation.succeeded(request);
        setPlan(nextPlan ?? receipt.plan); setSnapshot(latestIsland ?? receipt.island);
        setNextPlanError(Boolean(result.nextPlanError));
        const response = islandFeedbackForReceipt(plan, receipt.plan, receipt.event);
        const earnedReceipt = islandStarReceipt(plan, receipt.plan, receipt.event, lastStarReceipt.current);
        if (earnedReceipt) { lastStarReceipt.current = earnedReceipt; setStarReceipt(earnedReceipt); }
        setLearningFeedback(response?.feedback);
        if (island && receipt.plan.growthTarget && receipt.plan.status === 'completed') {
            const milestone = getIslandGrowthMilestone(island, receipt.island);
            if (milestone) setLatestMilestone({ id: receipt.plan.id, ...milestone });
        }
        setReaction(response?.reaction ? { ...response.reaction, growthTarget: plan.growthTarget } : undefined);
        if (response?.reaction?.kind === 'correct') {
            setPulse(value => value + 1);
            if (profile.soundEnabled) playSound(receipt.plan.status === 'completed' ? 'clear' : 'correct');
        }
        if (response?.feedback.kind === 'retry') playSound('incorrect');
        if (response?.feedback.kind === 'step') playSound('step');
        if (receipt.plan.status === 'completed' && !nextPlan) {
            if (isFirstIslandPlan(receipt.plan) && !receipt.plan.growthTarget) setScreen('reward');
            else setNextPlanError(true);
        }
    };
    const select = (item: IslandItem, current = island) => {
        if (!current || busy) return;
        setPlacementSuggestionId(item.position ? undefined : item.id);
        setPreview({ ...item, position: item.position ?? findAvailablePosition(current, item.kind, item.id) ?? { x: 0, z: 1 } });
        setFeedback(''); setScreen('placement');
    };
    const openCustomization = () => {
        if (busy) return;
        customization.open(); setPreview(undefined); setReaction(undefined); setPlayRequest(undefined);
        setFeedback(''); setScreen('customization');
    };
    const play = (itemId: string) => {
        if (busy || screen !== 'play') return;
        setPlayMessage(undefined);
        setPlayRequest({ id: crypto.randomUUID(), itemId });
    };
    const chooseGrowth = async (habitatId: IslandHabitatId) => {
        if (!island) return;
        const updated = await run(() => selectIslandGrowthTarget(profile.id, island.revision, habitatId));
        if (!updated) return;
        setSnapshot(updated); setScreen('home');
    };
    const appearance = async (level: number) => {
        if (!island || !preview) return;
        const updated = await run(() => setIslandItemAppearance(profile.id, island.revision, preview.id, level));
        if (!updated) return;
        setSnapshot(updated);
        const item = updated.items.find(candidate => candidate.id === preview.id);
        if (item) setPreview(previous => previous ? { ...previous, appearanceLevel: item.appearanceLevel } : previous);
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
    const learning = screen === 'learning';
    // Reserve one crop for the entire section, including later diagrams and their help.
    const complex = Boolean(plan?.slots.some(candidate => candidate.problem.inputType === 'multi-number'
        || candidate.problem.questionVisual?.kind === 'operation-base10' || parkHissanGrid(candidate.problem)));
    if (loadError) return <div className="island-loading" role="alert">しまを ひらけなかったよ。<button className="island-primary" onClick={() => window.location.reload()}>もういちど ひらく</button></div>;
    if (opening || !island) return <div className="island-loading" role="status">しまを ひらいているよ…</div>;
    const valid = Boolean(preview?.position && isValidIslandPlacement(island, preview.id, preview.position, preview.rotation));
    return <main className="island-page" data-game-id="mystic-island-v1" data-mode={screen} data-complex={Boolean(learning && complex)}
        data-visual-candidate-id={ISLAND_VISUAL_CANDIDATE} data-delivery-id={ISLAND_DELIVERY_ID}
        data-learning-candidate={ISLAND_LEARNING_CANDIDATE}
        data-island-revision={island.revision} data-discovery-count={island.growth?.discoveries.length ?? 0}
        data-build-revision={__BUILD_REVISION__} data-build-version={__APP_VERSION__} data-busy={busy}>
        <header className="island-header"><div className="island-brand"><Leaf size={20} /><div><p>{profile.name}の</p><h1>ふしぎな しま</h1></div></div>
            {learning ? <div className="island-learning-return">
                {island.pendingRewards.length > 0 && <span className="island-learning-gifts" aria-label={`おくりもの ${island.pendingRewards.length}こ`}><Gift size={15} aria-hidden="true" />{island.pendingRewards.length}</span>}
                <button className="island-text-button island-learning-pause" disabled={busy} onClick={home}>しまへ</button></div>
                : <button className="island-icon-button" aria-label="せってい" disabled={busy} onClick={() => navigate('/settings')}><Settings2 size={20} /></button>}
        </header>
        {(error || loadError) && <div className="island-error" role="alert"><p>{error}</p><button className="island-text-button" onClick={() => window.location.reload()}>よみなおす</button></div>}
        {screen !== 'album' && <IslandStage items={island.items} completedSets={island.completedSets} pulse={pulse} learning={learning}
            cosmetics={screen === 'customization' ? customization.preview ?? getIslandCosmetics(island) : getIslandCosmetics(island)}
            milestoneNotice={screen === 'customization' ? <IslandCustomizationPreviewNotice saved={getIslandCosmetics(island)} preview={customization.preview ?? getIslandCosmetics(island)} />
                : <>{learning && latestMilestone && <IslandMilestoneNotice key={latestMilestone.id} milestone={latestMilestone} island={island} />}
                    {(learning || screen === 'reward') && starReceipt && <IslandStarReceipt key={starReceipt} receiptId={starReceipt} />}</>}
            growth={island.growth} growthTarget={plan?.status === 'active' ? plan.growthTarget : undefined}
            districtFocus={learning || screen === 'customization' ? 'all' : district} readOnly={screen === 'growth' || screen === 'inventory' || screen === 'reward' || screen === 'customization'}
            onDiscovery={screen === 'customization' ? undefined : discoveries.capture}
            reaction={reaction} learningProgress={(learning || screen === 'reward') && plan
                ? { sectionId: plan.id, completed: plan.cursor, total: plan.slots.length } : undefined}
            preview={preview} previewValid={valid} selectedId={screen === 'play' ? playRequest?.itemId : preview?.id}
            placementSuggestionId={screen === 'placement' ? placementSuggestionId : undefined}
            onPlacementSuggestion={({ itemId, position }) => {
                setPreview(previous => previous?.id === itemId ? { ...previous, position } : previous);
                setPlacementSuggestionId(undefined);
            }}
            playRequest={screen === 'play' ? playRequest : undefined}
            onRendererRecovered={() => setPlayMessage(message => message === RENDERER_RECOVERY_HINT ? undefined : message)}
            onPlayResult={result => {
                if (result.requestId !== playRequest?.id) return;
                setPlayMessage(result.status === 'blocked' ? 'どうぶつが とおれる すきまを あけて みよう。'
                    : result.status === 'unavailable' ? (result.reason === 'renderer' ? RENDERER_RECOVERY_HINT : 'もちものから しまに おいて、あそぼう。')
                        : result.activity ? (result.activity === 'flower' ? 'おはなを おすそわけ。' : result.activity === 'star' ? 'ほしの ひかりを おすそわけ。' : 'みずたまを おすそわけ。')
                            : sharingHint(island.items, result.itemId) ?? 'ほかの ばしょも えらべるよ。');
            }}
            onGroundPoint={screen === 'placement' && !busy ? point => { setPlacementSuggestionId(undefined); setPreview(previous => {
                if (!previous) return previous;
                const position = { x: Math.round(point.x * 4) / 4, z: Math.round(point.z * 4) / 4 };
                return previous.position?.x === position.x && previous.position?.z === position.z ? previous : { ...previous, position };
            }); } : undefined}
            onItemSelect={!learning && !busy && screen !== 'customization' ? id => {
                if (screen === 'play') play(id);
                else { const item = island.items.find(candidate => candidate.id === id); if (item) select(item); }
            } : undefined} />}
        {(screen === 'home' || screen === 'play' || screen === 'placement') && <IslandDistricts island={island} value={district} disabled={busy} onChange={setDistrict} />}
        {learning && nextPlanError ? <section className="island-sheet island-learning-retry">
            <p role="status">{plan?.status === 'completed' ? 'ここまで といたぶんは のこっているよ。' : 'まだ もんだいを ひらけなかったよ。'}</p>
            <button className="island-primary" disabled={busy} onClick={() => void begin()}>つづきの もんだいを ひらく</button>
        </section>
            : learning && plan && slot ? <IslandLearningPanel plan={plan} intro={isFirstIslandPlan(plan)} observation={observation} busy={busy} feedback={learningFeedback} englishAutoRead={profile.englishAutoRead} onAction={action => void answer(action)}
                subjectChoice={profile.subjectMode === 'mix' ? {
                    selected: island.nextSubjectChoice?.afterPlanId === plan.id && island.nextSubjectChoice.subject === plan.subject,
                    onChange: selected => { void run(() => setIslandNextSubject(profile.id, island.revision, plan.id, selected))
                        .then(updated => { if (updated) setSnapshot(updated); }); },
                } : undefined} />
            : screen === 'reward' && island.pendingRewards.length ? <IslandRewards island={island} intro={island.completedSets === 1 && Boolean(plan && isFirstIslandPlan(plan))} disabled={busy} onChoose={(id, kind) => void claim(id, kind)} onContinue={() => void begin()} onClose={home} />
            : screen === 'play' ? <IslandPlay items={island.items} disabled={busy} selectedId={playRequest?.itemId} message={playMessage}
                onSelect={play} onMove={select} onInventory={() => setScreen('inventory')} onContinue={() => void begin()} onClose={home} />
            : screen === 'inventory' ? <IslandInventory items={island.items} disabled={busy} onSelect={select} onClose={home} />
                : screen === 'customization' ? <IslandCustomization island={island} selectedId={customization.selectedId}
                    preview={customization.preview ?? getIslandCosmetics(island)} celebration={customization.celebration} disabled={busy}
                    onSelect={customization.select} onAction={action => void customization.act(action)} onClose={home} />
                : screen === 'growth' ? <IslandGrowthChoices island={island} plan={plan} disabled={busy} onSelect={id => void chooseGrowth(id)} onClose={home} />
                : screen === 'album' ? <IslandAlbum island={island} initialComparison={albumComparison} disabled={busy} closeDisabled={comparisonDisabled} onClose={home}
                    onPlace={id => { const item = island.items.find(candidate => candidate.id === id); if (item) select(item); }}
                    onTry={(itemId, discoveryId) => { setPreview(undefined); setPlayMessage(undefined); setDistrict('all'); setScreen('play'); setPlayRequest({ id: crypto.randomUUID(), itemId, discoveryId }); }} />
                : screen === 'placement' && preview ? <IslandPlacement item={preview} valid={valid} disabled={busy}
                    onPoint={point => { setPlacementSuggestionId(undefined); setPreview({ ...preview, position: point }); }} onRotate={() => { setPlacementSuggestionId(undefined); setPreview({ ...preview, rotation: preview.rotation + Math.PI / 2 }); }}
                    onSave={() => void place()} onStore={() => void place(true)} onCancel={home} onAppearance={level => void appearance(level)} /> : <section className="island-home-controls">
                    {feedback && <p className="island-home-feedback" role="status">{feedback}</p>}
                    {latestMilestone ? <IslandMilestoneReturn milestone={latestMilestone} island={island} disabled={comparisonDisabled} onCompare={() => {
                        setAlbumComparison(latestMilestone.expansion ? 'all' : latestMilestone.habitats[0] ?? 'garden'); setScreen('album');
                    }} /> : null}
                    <IslandGrowthSummary island={island} plan={plan} disabled={busy} onChoose={() => setScreen('growth')} />
                    <button className="island-primary island-start" disabled={busy} onClick={() => void begin()}>{island.pendingPlanId ? 'つづきから とく' : 'まなぶ'}<ArrowRight size={22} /></button>
                    <IslandCustomizationGoal island={island} disabled={busy} onOpen={openCustomization} />
                    <div className="island-home-secondary"><button className="island-secondary island-play-entry" disabled={busy} onClick={() => {
                        setPlayRequest(undefined); setPlayMessage(undefined); setReaction(undefined); setPreview(undefined); setScreen('play');
                    }}><PawPrint size={20} />どうぶつと あそぶ</button>
                        {island.pendingRewards.length > 0 && <button className="island-secondary" disabled={busy} onClick={() => setScreen('reward')}><Gift size={20} /><span>おくりものを えらぶ<small>{island.pendingRewards.length}こ とどいているよ</small></span></button>}
                        <button className="island-secondary" disabled={busy} onClick={() => setScreen('inventory')}><PackageOpen size={20} />もちもの</button>
                        <button className="island-secondary" disabled={busy} onClick={openCustomization}><Sparkles size={20} />きせかえ</button>
                        <button className="island-secondary" disabled={comparisonDisabled} onClick={() => { setAlbumComparison('garden'); setScreen('album'); }}><BookOpen size={20} />アルバム</button></div>
                    <footer className="island-footer"><button className="island-text-button" disabled={busy} onClick={() => navigate('/battle')}>ほかの あそび</button></footer>
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
