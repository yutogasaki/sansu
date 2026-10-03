import { useEffect, useState } from 'react';
import { ArrowRight, ChevronDown, Flag, Settings2 } from 'lucide-react';
import type { SubjectKey, UserProfile } from '../../domain/types';
import { readLearningProgress } from '../../domain/learning/progressRepository';
import { learningLevelTitle } from '../../domain/learning/progressView';
import { independentCorrectCount } from '../../domain/learning/independentProgress';
import { MATH_SKILL_LABELS } from '../../domain/math/labels';
import { getWord } from '../../domain/english/words';
import { Button } from '../ui/Button';
import { FinishPreparation } from './FinishPreparation';
import { SurfacePanel } from '../ui/SurfacePanel';
import { IslandToyIcon } from '../island/IslandToyIcon';
import pokomoko from '../../assets/pokomoko-learning-poses.webp';
import './LearningProgressCards.css';

export function LearningProgressCards({ profile, refreshKey, onLearn, onFinish, onSettings }: {
    profile: UserProfile; refreshKey: boolean; onLearn: () => void;
    onFinish: (subject: SubjectKey) => void; onSettings: (subject: SubjectKey) => void;
}) {
    const [result, setResult] = useState<{ owner: string; data?: Awaited<ReturnType<typeof readLearningProgress>>; error?: boolean }>();
    const [retry, setRetry] = useState(0);
    useEffect(() => {
        if (refreshKey) return;
        let cancelled = false;
        void readLearningProgress(profile).then(data => { if (!cancelled) setResult({ owner: profile.id, data }); })
            .catch(() => { if (!cancelled) setResult({ owner: profile.id, error: true }); });
        return () => { cancelled = true; };
    }, [profile, refreshKey, retry]);
    const data = result?.owner === profile.id ? result.data : undefined;
    const subjects: SubjectKey[] = profile.subjectMode === 'mix' ? ['math', 'vocab'] : [profile.subjectMode];
    return <SurfacePanel className="learning-progress-card space-y-0 rounded-[28px] p-5" aria-label="つぎへの道" data-progress-candidate="progress-level-up-v4">
        <header><IslandToyIcon kind="island" size={28} /><h2>つぎへの 道</h2></header>
        {result?.owner === profile.id && result.error ? <div role="alert">きろくを 読みこめなかったよ。
            <Button variant="secondary" onClick={() => setRetry(value => value + 1)}>もういちど 読みこむ</Button></div>
            : !data ? <p role="status">きろくを 読みこんでいるよ…</p> : <div className="progress-subjects" data-subject-count={subjects.length}>{subjects.map(subject => {
                const view = data[subject];
                const successes = data.memories[subject].filter(memory => independentCorrectCount(memory) > 0 && memory.lastIndependentCorrectAt)
                    .sort((a, b) => b.lastIndependentCorrectAt!.localeCompare(a.lastIndependentCorrectAt!)).slice(0, 3);
                const subjectLabel = subject === 'math' ? 'さんすう' : 'えいたんご';
                return <section key={`${profile.id}-${subject}`} data-progress-stage={view.stage}
                    aria-label={subject === 'math' ? 'さんすうの進みぐあい' : 'えいたんごの進みぐあい'}>
                    <p className="progress-subject">{subjectLabel}</p>
                    <div className="progress-current">
                        <div className="progress-patch-current" aria-label={`いま Lv${view.main}`}>
                            <span className="progress-companion" style={{ backgroundImage: `url(${pokomoko})` }} aria-hidden="true" />
                            <span>Lv</span><strong>{view.main}</strong>
                        </div>
                        <div><p className="progress-current-label">いまの レベル</p><h3 className="progress-level-title">{learningLevelTitle(subject, view.main)}</h3></div>
                    </div>
                    <p className="progress-next">{view.next === null ? <><Flag size={16} aria-hidden="true" />ここまで 到着 · ふくしゅうへ</> : <><ArrowRight size={16} aria-hidden="true" /><span>つぎ Lv{view.next} · {learningLevelTitle(subject, view.next)}</span></>}</p>
                    <FinishPreparation view={view} compact />
                    {view.stage === 'ready' ? <Button className="progress-challenge-ready" onClick={() => onFinish(subject)} aria-label={`${subjectLabel}の レベルアップに ちょうせん`}>
                        <span>Lv{view.next}へ ちょうせん<small>20もん ぜんぶ ひとりでできたら レベルアップ</small></span><ArrowRight size={20} aria-hidden="true" />
                    </Button> : view.stage === 'paused' ? <button type="button" className="progress-settings" onClick={() => onSettings(subject)} aria-label="がくしゅう設定を ひらく">
                        <Settings2 size={18} aria-hidden="true" /><span>{view.pauseReason === 'disabled' ? `Lv${view.next}は オフ · 設定` : 'レベルの 設定を確認'}</span><ArrowRight size={16} aria-hidden="true" />
                    </button> : <p className="progress-status">{view.stage === 'complete' ? '覚えたことを また といてみよう' : 'つぎへ むけて れんしゅう中'}</p>}
                    <details className="progress-details">
                        <summary>{view.stage === 'complete' ? 'きろく' : 'くわしく・きろく'}<ChevronDown size={16} aria-hidden="true" /></summary>
                        <div className="progress-details-body">
                            {view.stage === 'paused' && <p>{view.message}</p>}
                            <FinishPreparation view={view} />
                            {successes.length > 0 && <div className="space-y-2">
                                <h4 className="font-bold">ひとりで できた きろく</h4>
                                {successes.map(memory => <div key={memory.id}>
                                    <p className="font-bold">{subject === 'math' ? MATH_SKILL_LABELS[memory.id] ?? 'さんすう' : getWord(memory.id)?.surface ?? memory.id}</p>
                                    <p className="text-pokomoko-muted">{new Date(memory.lastIndependentCorrectAt!).toLocaleDateString('ja-JP')} にできた · {memory.needsRelearning ? 'もういちど れんしゅう中' : Date.parse(memory.nextReview) <= Date.now() ? 'ふくしゅうの ころだよ' : `つぎの ふくしゅう ${new Date(memory.nextReview).toLocaleDateString('ja-JP')}`}</p>
                                </div>)}
                            </div>}
                        </div>
                    </details>
                </section>;
            })}</div>}
        <Button variant="secondary" className="min-h-11 w-full" onClick={onLearn}>れんしゅうを つづける</Button>
    </SurfacePanel>;
}
