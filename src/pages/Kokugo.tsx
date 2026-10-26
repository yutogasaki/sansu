import { useCallback, useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation, useNavigate } from 'react-router-dom';
import { db } from '../db';
import { actKokugo } from '../domain/kokugo/actions';
import { itemsForUnit } from '../domain/kokugo/catalog';
import { kokugoUnit } from '../domain/kokugo/curriculum';
import { chooseKokugo, presentKokugo, reserveKokugo } from '../domain/kokugo/repository';
import { drainKokugoRewards } from '../domain/growingIsland/kokugoReceipts';
import type { KokugoAction, KokugoPlan } from '../domain/kokugo/types';
import { useLearningSessionLease } from '../hooks/useLearningSessionLease';
import { KokugoCatalog } from '../components/kokugo/KokugoCatalog';
import { KokugoQuestion } from '../components/kokugo/KokugoQuestion';
import { KokugoActivities, KokugoReading } from '../components/kokugo/KokugoActivities';
import { KokugoProgressCard } from '../components/kokugo/KokugoProgress';
import '../components/kokugo/kokugo.css';
export default function Kokugo() {
    const navigate = useNavigate(), location = useLocation();
    const data = useLiveQuery(async () => {
        const app = await db.appData.get('app');
        const profile = app?.activeProfileId ? await db.profiles.get(app.activeProfileId) : undefined;
        if (!profile) return null;
        return { profile, course: await db.kokugoCourses.get(profile.id),
            pending: await db.kokugoPlans.where('[profileId+status]').equals([profile.id, 'pending']).first() };
    });
    const profileId = data?.profile.id;
    const lease = useLearningSessionLease(profileId);
    const [plan, setPlan] = useState<KokugoPlan | null>(null), [band, setBand] = useState(1);
    const [view, setView] = useState<'catalog' | 'learn' | 'activity' | 'read'>('catalog');
    const [focusTarget, setFocusTarget] = useState<string>();
    const [unitId, setUnitId] = useState('E08'), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    const busyRef = useRef(false), initialized = useRef(''), entryOwner = useRef(''), activated = useRef(false);
    const [activitySaving, setActivitySaving] = useState(false);
    const onError = useCallback((message: string) => setError(message), []);
    const run = useCallback(async (work: () => Promise<void>) => {
        if (busyRef.current) return;
        busyRef.current = true; setBusy(true); setError('');
        try { await work(); } catch (error) { setError(error instanceof Error ? error.message : String(error)); }
        finally { busyRef.current = false; setBusy(false); }
    }, []);
    useEffect(() => {
        if (!data || initialized.current === data.profile.id) return;
        if (!entryOwner.current) entryOwner.current = data.profile.id;
        initialized.current = data.profile.id;
        setBand(data.course?.band ?? Math.min(7, Math.max(0, data.profile.grade + 1))); setPlan(data.pending ?? null); setView(data.pending ? 'learn' : 'catalog');
    }, [data]);
    useEffect(() => {
        if (!data || lease !== 'ready' || activated.current || data.profile.id !== entryOwner.current) return;
        activated.current = true;
        if (!data.course?.preferred) void run(async () => {
            await chooseKokugo(data.profile.id, data.pending?.unitId ?? data.course?.unitId ?? 'K01',
                data.course?.band ?? Math.min(7, Math.max(0, data.profile.grade + 1)));
        });
    }, [data, lease, run]);
    useEffect(() => {
        if (error || busy || lease !== 'ready' || !profileId || view !== 'learn' || !plan || plan.status !== 'pending'
            || !plan.introDone || plan.slots[plan.cursor].presentation) return;
        void run(async () => { setPlan(await presentKokugo(profileId, plan.id)); });
    }, [error, busy, lease, profileId, plan, view, run]);
    const draftQueue = useRef(Promise.resolve()), draftCount = useRef(0);
    const saveDraft = (answer: string) => {
        if (!profileId || !plan || lease !== 'ready') return Promise.resolve();
        const planId = plan.id;
        draftCount.current += 1; busyRef.current = true; setBusy(true);
        draftQueue.current = draftQueue.current.catch(() => undefined).then(async () => {
            try {
                const saved = await db.kokugoPlans.get(planId);
                if (!saved) throw new Error('つづきを ひらきなおしてね。');
                const next = await actKokugo({ profileId, planId, revision: saved.revision, action: 'draft', answer });
                if (initialized.current === profileId) setPlan(next);
            } catch (error) { setError(error instanceof Error ? error.message : String(error)); }
            finally { draftCount.current -= 1; if (draftCount.current === 0) { busyRef.current = false; setBusy(false); } }
        });
        return draftQueue.current;
    };
    const action = async (action: KokugoAction['action'], answer?: string) => {
        if (!profileId || !plan || lease !== 'ready') return;
        await run(async () => {
            const next = await actKokugo({ profileId, planId: plan.id, revision: plan.revision, action, answer });
            setPlan(next);
            if (action === 'answer' || action === 'complete-supported') {
                try { await drainKokugoRewards(profileId); } catch { /* The durable outbox retries when the island opens. */ }
            }
        });
    };
    const choose = async (unitId: string, target?: string) => {
        if (!profileId || lease !== 'ready') return;
        await run(async () => {
            await chooseKokugo(profileId, unitId, band, true, db, { focusTarget: target });
            setUnitId(unitId); setFocusTarget(target);
            if (itemsForUnit(unitId, target)[0]?.form === 'activity') { setView('activity'); return; }
            setPlan(await reserveKokugo(profileId, unitId)); setView('learn');
        });
    };
    const state = location.state as { returnTo?: string; islandParent?: { href?: string } } | null;
    const parent = state?.returnTo ?? state?.islandParent?.href;
    const returnTo = parent?.startsWith('/') && !parent.startsWith('//') ? parent : '/island';
    const returnLabel = returnTo.split('?')[0] === '/island' ? 'しまへ 戻る' : 'もどる';
    const locked = busy || (data !== null && lease !== 'ready') || activitySaving;
    const legacy = async () => {
        if (!profileId || locked) return;
        await run(async () => {
            await chooseKokugo(profileId, data?.pending?.unitId ?? data?.course?.unitId ?? 'K01', band, false);
            navigate('/island?learn=1', { replace: true });
        });
    };
    return <div className="kokugo-screen" data-kokugo-version="kokugo-v1">
        <header className="kokugo-header"><button disabled={locked} onClick={() => navigate(returnTo, { replace: true })}>{returnLabel}</button>
            <span>国語</span>{view !== 'catalog' && <button disabled={locked} onClick={() => { setView('catalog'); setError(''); }}>コースへ</button>}</header>
        <main className="kokugo-content">
            {data === null ? <section><h1>プロフィールを えらんでね</h1><button onClick={() => navigate('/onboarding', { replace: true })}>はじめの画面へ</button></section> : !data ? <p role="status">国語を よみこんでいるよ…</p> : <>
                {lease === 'loading' && <p role="status">つづきを たしかめているよ…</p>}
                {lease === 'blocked' && <p role="alert">ほかの画面で 学習中だよ。そちらを 閉じてから、ここを 開きなおしてね。</p>}
                {error && <div className="kokugo-error" role="alert">{error}<button onClick={() => { void run(async () => { await chooseKokugo(data.profile.id, data.pending?.unitId ?? data.course?.unitId ?? 'K01', band); if (plan) setPlan(await db.kokugoPlans.get(plan.id) ?? null); }); }}>保存した つづきを 読む</button></div>}
                {view === 'catalog' && <><KokugoCatalog profileId={data.profile.id} band={band} onBand={setBand} busy={locked} pending={data.pending}
                    onResume={() => { setPlan(data.pending ?? null); setView('learn'); }} onChoose={(unit, target) => void choose(unit, target)} onRead={() => setView('read')} />
                    <KokugoProgressCard profileId={profileId} /></>}
                {view === 'learn' && plan && (plan.status === 'completed' ? <section className="kokugo-finished"><p className="kokugo-eyebrow">ひとくぎり</p><h1>ここまで できたね</h1>
                    <p>自分でできた問題と、たしかめた問題を きろくしたよ。</p><p>つづきは、また 好きなときに。</p>
                    <button className="kokugo-primary" disabled={locked} onClick={() => setView('catalog')}>内容を えらぶ</button>
                    <button disabled={locked} onClick={() => navigate(returnTo, { replace: true })}>{returnLabel}</button></section>
                    : !plan.introDone ? <section className="kokugo-intro"><p className="kokugo-eyebrow">はじめに</p><h1>{kokugoUnit(plan.unitId).title}</h1>
                        <div className="kokugo-passage">{kokugoUnit(plan.unitId).introduction}</div><p>ヒントや おてほんを 見ても 大丈夫。あとで やってもいいよ。</p>
                        <button className="kokugo-primary" disabled={locked} onClick={() => void action('intro')}>{plan.slots.length}もん やってみる</button></section>
                        : <><p className="kokugo-review-note">{plan.repeatedPractice ? 'いまは 同じ例で れんしゅうするよ。新しい例での 確認は またあとで。' : ''}</p><KokugoQuestion key={`${plan.id}:${plan.cursor}`} plan={plan} busy={locked} soundEnabled={data.profile.soundEnabled} onAction={action} onDraft={saveDraft} /></>)}
                {view === 'activity' && <KokugoActivities key={`${profileId}:${unitId}:${focusTarget}`} focusTarget={focusTarget} profileId={data.profile.id} unitId={unitId} busy={busy || lease !== 'ready'} onError={onError} onSaving={setActivitySaving} />}
                {view === 'read' && <KokugoReading profileId={data.profile.id} busy={locked} onError={onError} />}
                <footer className="kokugo-footer"><button disabled={locked} onClick={() => void legacy()}>算数・英語を まなぶ</button><small>とちゅうの問題は そのまま のこるよ。</small></footer>
            </>}
        </main>
    </div>;
}
