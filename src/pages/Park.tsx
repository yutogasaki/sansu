import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { getActiveProfile } from '../domain/user/repository';
import type { UserProfile } from '../domain/types';
import { courseLayout, PARTS } from '../domain/park/course';
import { openPark, recordParkVisit, saveParkEdit, startParkPlan } from '../domain/park/repository';
import { commitParkLearning } from '../domain/park/commit';
import { simulateCourse } from '../domain/park/simulation';
import type { ParkLearningAction, PartKind } from '../domain/park/types';
import { ParkStage } from '../components/park/ParkStage';
import { beatDuration } from '../components/park/playback';
import { ParkEditor } from '../components/park/ParkEditor';
import { PartWorkshop } from '../components/park/PartWorkshop';
import { PartIcon } from '../components/park/PartArt';
import { ParkAnswerForm } from '../components/park/ParkAnswerForm';
import { useParkActions } from '../components/park/useParkActions';
import { reachPwaUpdateCheckpoint } from '../pwa';
import '../components/park/Park.css';

type Playback = { id: string; courseId: string; layout: (PartKind | null)[]; index: number; done: boolean };

function ParkSession({ profile }: { profile: UserProfile }) {
    const navigate = useNavigate();
    const park = useLiveQuery(() => db.parks.get(profile.id), [profile.id]);
    const plan = useLiveQuery(() => park?.pendingPlanId ? db.parkPlans.get(park.pendingPlanId) : undefined, [park?.pendingPlanId]);
    const [screen, setScreen] = useState<'course' | 'workshop' | 'learning'>('course');
    const [editing, setEditing] = useState(false);
    const [play, setPlay] = useState<Playback>();
    const [message, setMessage] = useState('');
    const { busy, error, run } = useParkActions();
    const playing = Boolean(play && !play.done);
    useEffect(() => {
        if (!play || play.done) return;
        const timer = window.setTimeout(() => {
            if (play.index + 1 < simulateCourse(play.layout).length) setPlay({ ...play, index: play.index + 1 });
            else {
                setPlay({ ...play, done: true });
                void run(() => recordParkVisit(profile.id, `${play.id}:completed`, 'replay_completed', play.courseId));
            }
        }, beatDuration(simulateCourse(play.layout)[play.index]));
        return () => window.clearTimeout(timer);
    }, [play, profile.id, run]);

    const replay = async () => {
        if (!park) return;
        const id = crypto.randomUUID();
        const event = await run(() => recordParkVisit(profile.id, id, 'replay_started', park.activeCourseId));
        if (!event || reachPwaUpdateCheckpoint('park-replay', { protectNextSession: true })) return;
        setEditing(false);
        setMessage('');
        setPlay({ id, courseId: park.activeCourseId, layout: event.layout!, index: 0, done: false });
    };
    const resume = async () => {
        if (!park || !plan) return;
        const event = await run(() => recordParkVisit(profile.id, crypto.randomUUID(), 'learning_resumed', park.activeCourseId));
        if (event && !reachPwaUpdateCheckpoint('park-learning', { protectNextSession: true })) { setScreen('learning'); setMessage(''); }
    };
    const choose = async (kind: PartKind) => {
        const reserved = await run(() => startParkPlan(profile.id, kind));
        if (reserved && !reachPwaUpdateCheckpoint('park-learning', { protectNextSession: true })) { setScreen('learning'); setMessage(''); }
    };
    const answer = async (action: ParkLearningAction) => {
        if (!plan) return;
        const receipt = await run(() => commitParkLearning(profile.id, plan.id, plan.revision, action));
        if (!receipt) return;
        if (receipt.plan.status === 'completed') {
            setMessage(`${PARTS[receipt.plan.partKind].name}が できた！ ならべてみよう。`);
            setPlay(undefined);
            setEditing(true);
            setScreen('course');
        } else if (action.type === 'skipped') {
            setScreen('course');
            setMessage('つづきは そのまま。コースで あそべるよ。');
        } else if (receipt.event.result?.includes('incorrect')) setMessage('もういちど ためそう。いっしょに みることも できるよ。');
        else setMessage('');
    };

    if (!park) return <p role="status">ゆうえんちを ひらいているよ…</p>;
    const course = park.courses.find(c => c.id === park.activeCourseId)!;
    const layout = courseLayout(park, course.id);
    const slot = plan?.slots[plan.cursor];
    return <div className="park-page" data-game-id="build-play-v1" data-visual-lineage-id="little-park-v1" data-visual-candidate-id="little-park-vector-v1" data-visual-mode={screen === 'learning' ? 'learning' : 'toy-course'}
        data-build-revision={__BUILD_REVISION__} data-delivery-id="build-play-v1">
        <header className="park-header">
            <div><p>{profile.name}の</p><h1>ちいさな遊園地</h1></div>
            <button className="park-text-button" disabled={busy} onClick={() => navigate('/settings')}>せってい</button>
        </header>
        {error && <div role="alert" className="park-support"><p>{error}</p><button className="park-text-button" onClick={() => window.location.reload()}>よみなおす</button></div>}
        {message && <p className="park-message" role="status">{message}</p>}
        {screen === 'workshop' ? <PartWorkshop first={park.completedPlans === 0} disabled={busy} onChoose={kind => void choose(kind)} onBack={() => setScreen('course')} />
            : screen === 'learning' && plan && slot ? <section className="park-learning" aria-label="ぶひんを つくる おべんきょう">
                <div className="park-learning-header"><span className="park-small-part"><PartIcon kind={plan.partKind} /></span>
                    <p>{PARTS[plan.partKind].name}を つくろう<br /><small>{plan.subject === 'math' ? 'さんすう' : 'えいたんご'} · {plan.cursor + 1} / {plan.slots.length}</small></p>
                    <button className="park-text-button" disabled={busy} onClick={() => { setScreen('course'); setMessage('つづきは そのまま とっておくよ。'); }}>ひとやすみ</button>
                </div>
                <ParkAnswerForm key={`${plan.id}:${plan.revision}`} slot={slot} disabled={busy} onAnswer={value => void answer({ type: 'answer', answer: value })} />
                <div className="park-learning-actions">
                    {!slot.assisted && <button className="park-text-button" disabled={busy} onClick={() => void answer({ type: 'support_opened' })}>いっしょに みる</button>}
                    <button className="park-text-button" disabled={busy} onClick={() => void answer({ type: 'skipped' })}>このもんだいは あとで</button>
                </div>
            </section> : <>
                <nav className="park-courses" aria-label="じぶんの コース">
                    {park.courses.map((c, i) => <button key={c.id} className="park-course-tab" disabled={busy || playing} aria-pressed={course.id === c.id}
                        onClick={() => { void run(() => saveParkEdit(profile.id, park.revision, { type: 'select-course', courseId: c.id })); setPlay(undefined); }}>
                        <span className="park-course-thumb">{courseLayout(park, c.id).map((kind, position) => kind ? <PartIcon key={position} kind={kind} /> : <span key={position}>·</span>)}</span>
                        {c.name || `コース ${i + 1}`}
                    </button>)}
                    {park.courses.length < 3 && <button className="park-text-button" disabled={busy || playing} onClick={() => { setPlay(undefined); setEditing(true); void run(() => saveParkEdit(profile.id, park.revision, { type: 'add-course' })); }}>＋</button>}
                </nav>
                <ParkStage layout={play?.layout ?? layout} beat={play ? simulateCourse(play.layout)[play.index] : undefined} preview={editing && !play} sound={profile.soundEnabled} />
                <div className="park-main-actions">
                    {playing ? <button className="park-button park-primary" disabled={busy} onClick={() => { setPlay(undefined); setEditing(true); }}>とめて つくりなおす</button>
                        : <button className="park-button park-primary" disabled={busy} onClick={() => void replay()}>▷ {play ? 'もういっかい' : 'あそばせる'}</button>}
                    {!playing && <button className="park-button" disabled={busy} onClick={() => { setEditing(!editing); setPlay(undefined); }}>{editing ? 'ならべおわり' : 'ならべかえる'}</button>}
                </div>
                {editing && !playing && <><ParkEditor key={course.id} park={park} disabled={busy} onEdit={edit => { setPlay(undefined); void run(() => saveParkEdit(profile.id, park.revision, edit)); }} />
                    <label className="park-course-name">コースの なまえ（なくても いいよ）<input key={`${course.id}:${course.name}`} defaultValue={course.name} maxLength={24} disabled={busy}
                        onBlur={event => { if (event.target.value !== course.name) void run(() => saveParkEdit(profile.id, park.revision, { type: 'rename', courseId: course.id, name: event.target.value })); }} /></label>
                </>}
                {!playing && <div className="park-build-next"><div><small>{plan ? 'つくりかけ' : 'つぎの おたのしみ'}</small><p>{plan ? PARTS[plan.partKind].name : park.completedPlans === 0 ? 'シャボンゲート' : 'あたらしい ぶひん'}</p></div>
                    <button className="park-button" disabled={busy || Boolean(park.pendingPlanId && !plan)} onClick={() => { if (plan) void resume(); else setScreen('workshop'); }}>{plan ? 'つづきから' : 'つくる'}</button></div>}
                <footer className="park-footer"><span>コースは じどうで のこるよ</span><button className="park-text-button" disabled={busy} onClick={() => navigate('/study')}>べんきょう</button><button className="park-text-button" disabled={busy} onClick={() => navigate('/battle')}>きちへ</button></footer>
            </>}
    </div>;
}

export default function Park() {
    const [profile, setProfile] = useState<UserProfile>();
    const [error, setError] = useState(false);
    const navigate = useNavigate();
    const resolve = useCallback(async () => {
        const current = await getActiveProfile();
        if (!current) { navigate('/onboarding', { replace: true }); return undefined; }
        await openPark(current.id);
        return current;
    }, [navigate]);
    useEffect(() => {
        let mounted = true;
        const refresh = () => { void resolve().then(p => { if (mounted) setProfile(p); }).catch(() => { if (mounted) setError(true); }); };
        refresh();
        window.addEventListener('storage', refresh);
        window.addEventListener('focus', refresh);
        return () => { mounted = false; window.removeEventListener('storage', refresh); window.removeEventListener('focus', refresh); };
    }, [resolve]);
    if (error) return <div className="park-page" role="alert">まだ ひらけなかったよ。<button onClick={() => window.location.reload()}>もういちど ひらく</button></div>;
    return profile ? <ParkSession key={profile.id} profile={profile} /> : <p role="status">ゆうえんちを ひらいているよ…</p>;
}
